"""Receipt OCR pipeline (RCT-4) and its enqueue hook (RCT-2).

``process_receipt_ocr`` runs Tesseract against the uploaded image, stores the raw
text in ``ocr_result``, then parses line items (RCT-5) and auto-categorises them
(RCT-6). It moves the receipt through pending → processing → completed, and on any
failure sets ``ocr_status=failed`` without letting the exception crash the worker.
"""

import logging
import uuid
from datetime import UTC, datetime

import pytesseract
from PIL import Image
from sqlalchemy import select

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Category, OcrStatus, Receipt, ReceiptLineItem
from app.utils.categoriser import suggest_category_id
from app.utils.receipt_parser import parse_line_items

logger = logging.getLogger(__name__)


def enqueue_ocr(receipt_id: uuid.UUID) -> None:
    """Dispatch the OCR job to the Celery worker (falls back to a log if unavailable)."""
    try:
        process_receipt_ocr.delay(str(receipt_id))
    except Exception:  # broker unreachable — leave the receipt pending for a retry
        logger.exception("Could not enqueue OCR for receipt %s", receipt_id)


@celery_app.task(name="process_receipt_ocr", bind=True)
def process_receipt_ocr(self, receipt_id: str) -> dict:
    rid = uuid.UUID(receipt_id)
    with SessionLocal() as db:
        receipt = db.get(Receipt, rid)
        if receipt is None:
            logger.warning("OCR task: receipt %s not found", receipt_id)
            return {"receipt_id": receipt_id, "status": "not_found"}

        receipt.ocr_status = OcrStatus.PROCESSING
        db.commit()

        try:
            text = pytesseract.image_to_string(Image.open(receipt.image_url))

            receipt.ocr_result = {"engine": "tesseract", "text": text}

            category_pairs = [
                (row.id, row.name)
                for row in db.execute(
                    select(Category.id, Category.name).where(
                        Category.user_id == receipt.user_id
                    )
                ).all()
            ]

            for parsed in parse_line_items(text):
                db.add(
                    ReceiptLineItem(
                        receipt_id=receipt.id,
                        description=parsed.description,
                        amount=parsed.amount,
                        category_id=suggest_category_id(parsed.description, category_pairs),
                    )
                )

            receipt.ocr_status = OcrStatus.COMPLETED
            receipt.processed_at = datetime.now(UTC)
            db.commit()
            logger.info("OCR completed for receipt %s", receipt_id)
            return {"receipt_id": receipt_id, "status": "completed"}
        except Exception as exc:
            db.rollback()
            receipt = db.get(Receipt, rid)
            if receipt is not None:
                receipt.ocr_status = OcrStatus.FAILED
                receipt.ocr_result = {"error": str(exc)}
                receipt.processed_at = datetime.now(UTC)
                db.commit()
            logger.exception("OCR failed for receipt %s", receipt_id)
            return {"receipt_id": receipt_id, "status": "failed", "error": str(exc)}
