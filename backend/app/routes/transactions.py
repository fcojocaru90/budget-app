import uuid
from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import ValidationError
from sqlalchemy import func, select

from app.dependencies import CurrentUser, DbSession
from app.models import Category, Transaction
from app.schemas import (
    CsvImportResult,
    CsvRowError,
    TransactionCreate,
    TransactionPage,
    TransactionRead,
    TransactionUpdate,
)
from app.utils.csv_parser import ColumnMapping, parse_csv

router = APIRouter()

MAX_CSV_BYTES = 5 * 1024 * 1024


def _get_owned_transaction(
    db: DbSession, user_id: uuid.UUID, transaction_id: uuid.UUID
) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def _validate_category(db: DbSession, user_id: uuid.UUID, category_id: uuid.UUID | None) -> None:
    if category_id is None:
        return
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=422, detail="Unknown category")


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(payload: TransactionCreate, db: DbSession, user: CurrentUser):
    _validate_category(db, user.id, payload.category_id)
    transaction = Transaction(user_id=user.id, **payload.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.post("/import-csv", response_model=CsvImportResult, status_code=201)
async def import_csv(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    mapping: str = Form(...),
):
    try:
        column_mapping = ColumnMapping.model_validate_json(mapping)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())

    raw = await file.read()
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="CSV file too large (max 5 MB)")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File is not valid UTF-8 text")

    result = parse_csv(content, column_mapping)

    # Persist all parsed rows in a single transaction; parse errors are reported,
    # not fatal, so a mostly-good file still imports its good rows.
    for parsed in result.transactions:
        db.add(
            Transaction(
                user_id=user.id,
                source=parsed.source,
                amount=parsed.amount,
                currency=parsed.currency,
                description=parsed.description,
                transaction_date=parsed.transaction_date,
            )
        )
    db.commit()

    return CsvImportResult(
        imported=len(result.transactions),
        failed=len(result.errors),
        errors=[CsvRowError(row=e.row, message=e.message) for e in result.errors],
    )


@router.get("", response_model=TransactionPage)
def list_transactions(
    db: DbSession,
    user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: uuid.UUID | None = None,
):
    query = select(Transaction).where(Transaction.user_id == user.id)
    if date_from is not None:
        query = query.where(Transaction.transaction_date >= date_from)
    if date_to is not None:
        query = query.where(Transaction.transaction_date <= date_to)
    if category_id is not None:
        query = query.where(Transaction.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return TransactionPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: uuid.UUID, db: DbSession, user: CurrentUser):
    return _get_owned_transaction(db, user.id, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: uuid.UUID, payload: TransactionUpdate, db: DbSession, user: CurrentUser
):
    transaction = _get_owned_transaction(db, user.id, transaction_id)
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        _validate_category(db, user.id, updates["category_id"])
    for field, value in updates.items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: uuid.UUID, db: DbSession, user: CurrentUser):
    transaction = _get_owned_transaction(db, user.id, transaction_id)
    db.delete(transaction)
    db.commit()
