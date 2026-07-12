"""Analytics aggregations (ANALYTICS-1, ANALYTICS-2).

Income/expense are classified by sign, consistent with the budget calculation:
positive transaction amounts are income, negative amounts are expenses, and receipt
line items are always expenses. Investable surplus is income minus total expenses.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Receipt, ReceiptLineItem, Transaction

DEFAULT_CURRENCY = "RON"


def month_bounds(month: str | None, today: date | None = None) -> tuple[date, date, str]:
    """Resolve an optional 'YYYY-MM' string to [start, end) dates and a label.

    Falls back to the current month when *month* is None.
    """
    today = today or date.today()
    if month:
        year, mon = (int(p) for p in month.split("-"))
    else:
        year, mon = today.year, today.month
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end, f"{year:04d}-{mon:02d}"


@dataclass
class Summary:
    month: str
    income: Decimal
    expenses: Decimal
    surplus: Decimal
    currency: str


@dataclass
class CategoryTotal:
    category_id: uuid.UUID | None
    category_name: str
    category_colour: str | None
    total: Decimal


def compute_summary(db: Session, user_id: uuid.UUID, start: date, end: date, label: str) -> Summary:
    income = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.amount > 0,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
    )
    txn_expenses = db.scalar(
        select(func.coalesce(func.sum(-Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.amount < 0,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
    )
    receipt_expenses = db.scalar(
        select(func.coalesce(func.sum(ReceiptLineItem.amount), 0))
        .join(Receipt, ReceiptLineItem.receipt_id == Receipt.id)
        .where(
            Receipt.user_id == user_id,
            Receipt.uploaded_at >= start,
            Receipt.uploaded_at < end,
        )
    )
    income = Decimal(income)
    expenses = Decimal(txn_expenses) + Decimal(receipt_expenses)
    return Summary(
        month=label,
        income=income,
        expenses=expenses,
        surplus=income - expenses,
        currency=DEFAULT_CURRENCY,
    )


def compute_by_category(
    db: Session, user_id: uuid.UUID, start: date, end: date
) -> list[CategoryTotal]:
    """Per-category expense totals (outflows) for the period, including receipts.

    Transactions with no category are grouped under a single 'Uncategorised' bucket.
    """
    totals: dict[uuid.UUID | None, CategoryTotal] = {}

    txn_rows = db.execute(
        select(
            Transaction.category_id,
            Category.name,
            Category.colour,
            func.sum(-Transaction.amount),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.amount < 0,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
        .group_by(Transaction.category_id, Category.name, Category.colour)
    ).all()

    receipt_rows = db.execute(
        select(
            ReceiptLineItem.category_id,
            Category.name,
            Category.colour,
            func.sum(ReceiptLineItem.amount),
        )
        .join(Receipt, ReceiptLineItem.receipt_id == Receipt.id)
        .outerjoin(Category, ReceiptLineItem.category_id == Category.id)
        .where(
            Receipt.user_id == user_id,
            Receipt.uploaded_at >= start,
            Receipt.uploaded_at < end,
        )
        .group_by(ReceiptLineItem.category_id, Category.name, Category.colour)
    ).all()

    for category_id, name, colour, amount in [*txn_rows, *receipt_rows]:
        key = category_id
        existing = totals.get(key)
        if existing is None:
            totals[key] = CategoryTotal(
                category_id=category_id,
                category_name=name if category_id else "Uncategorised",
                category_colour=colour if category_id else None,
                total=Decimal(amount),
            )
        else:
            existing.total += Decimal(amount)

    return sorted(totals.values(), key=lambda c: c.total, reverse=True)
