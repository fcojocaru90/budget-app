import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import settings
from app.dependencies import CurrentUser, DbSession
from app.models import Category, Receipt, ReceiptLineItem
from app.schemas import (
    ReceiptLineItemCreate,
    ReceiptLineItemRead,
    ReceiptLineItemUpdate,
    ReceiptRead,
)
from app.tasks.ocr import enqueue_ocr

router = APIRouter()


def _validate_category(db: DbSession, user_id: uuid.UUID, category_id: uuid.UUID | None) -> None:
    if category_id is None:
        return
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=422, detail="Unknown category")


def _get_owned_line_item(
    db: DbSession, receipt: Receipt, line_id: uuid.UUID
) -> ReceiptLineItem:
    line = db.get(ReceiptLineItem, line_id)
    if line is None or line.receipt_id != receipt.id:
        raise HTTPException(status_code=404, detail="Line item not found")
    return line

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


def _get_owned_receipt(db: DbSession, user_id: uuid.UUID, receipt_id: uuid.UUID) -> Receipt:
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.user_id != user_id:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.post("/upload", response_model=ReceiptRead, status_code=201)
async def upload_receipt(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
):
    ext = ALLOWED_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported image type {file.content_type!r} "
            f"(allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))})",
        )

    raw = await file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    storage_dir = Path(settings.ocr_storage_path)
    storage_dir.mkdir(parents=True, exist_ok=True)
    receipt_id = uuid.uuid4()
    path = storage_dir / f"{receipt_id}{ext}"
    path.write_bytes(raw)

    receipt = Receipt(id=receipt_id, user_id=user.id, image_url=str(path))
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    # Return immediately; OCR runs asynchronously (RCT-3/RCT-4).
    enqueue_ocr(receipt.id)
    return receipt


@router.get("", response_model=list[ReceiptRead])
def list_receipts(db: DbSession, user: CurrentUser):
    return db.scalars(
        select(Receipt)
        .where(Receipt.user_id == user.id)
        .order_by(Receipt.uploaded_at.desc())
    ).all()


@router.get("/{receipt_id}", response_model=ReceiptRead)
def get_receipt(receipt_id: uuid.UUID, db: DbSession, user: CurrentUser):
    return _get_owned_receipt(db, user.id, receipt_id)


@router.get("/{receipt_id}/image")
def get_receipt_image(receipt_id: uuid.UUID, db: DbSession, user: CurrentUser):
    receipt = _get_owned_receipt(db, user.id, receipt_id)
    path = Path(receipt.image_url)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image file missing")
    return FileResponse(path)


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: uuid.UUID, db: DbSession, user: CurrentUser):
    receipt = _get_owned_receipt(db, user.id, receipt_id)
    Path(receipt.image_url).unlink(missing_ok=True)
    db.delete(receipt)
    db.commit()


# --- Manual line-item correction (RCT-8) ---


@router.post(
    "/{receipt_id}/line-items", response_model=ReceiptLineItemRead, status_code=201
)
def add_line_item(
    receipt_id: uuid.UUID,
    payload: ReceiptLineItemCreate,
    db: DbSession,
    user: CurrentUser,
):
    receipt = _get_owned_receipt(db, user.id, receipt_id)
    _validate_category(db, user.id, payload.category_id)
    line = ReceiptLineItem(receipt_id=receipt.id, **payload.model_dump())
    db.add(line)
    db.commit()
    db.refresh(line)
    return line


@router.put(
    "/{receipt_id}/line-items/{line_id}", response_model=ReceiptLineItemRead
)
def update_line_item(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: ReceiptLineItemUpdate,
    db: DbSession,
    user: CurrentUser,
):
    receipt = _get_owned_receipt(db, user.id, receipt_id)
    line = _get_owned_line_item(db, receipt, line_id)
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        _validate_category(db, user.id, updates["category_id"])
    for field, value in updates.items():
        setattr(line, field, value)
    db.commit()
    db.refresh(line)
    return line


@router.delete("/{receipt_id}/line-items/{line_id}", status_code=204)
def delete_line_item(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
):
    receipt = _get_owned_receipt(db, user.id, receipt_id)
    line = _get_owned_line_item(db, receipt, line_id)
    db.delete(line)
    db.commit()
