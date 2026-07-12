"""Budget vs. actual spend calculation (BUD-2).

For each of a user's budget targets, aggregate the current month's spend for that
category — outflows from transactions plus receipt line items — and compare it
against the target's monthly limit.

Sign convention: transaction expenses are stored as negative amounts (e.g. bank
debits), so category spend is the absolute value of the negative sum. Receipt line
items are always purchases, so their amounts count in full.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BudgetTarget, Category, Receipt, ReceiptLineItem, Transaction


@dataclass
class BudgetSpend:
    category_id: uuid.UUID
    category_name: str
    category_colour: str
    monthly_limit: Decimal
    currency: str
    spent: Decimal
    remaining: Decimal
    percentage: float
    over_budget: bool


def _month_bounds(today: date) -> tuple[date, date]:
    start = today.replace(day=1)
    end = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(
        month=start.month + 1
    )
    return start, end


def compute_budget_summary(
    db: Session, user_id: uuid.UUID, today: date | None = None
) -> tuple[str, list[BudgetSpend]]:
    today = today or date.today()
    month_start, month_end = _month_bounds(today)

    targets = db.scalars(
        select(BudgetTarget)
        .join(Category, BudgetTarget.category_id == Category.id)
        .where(BudgetTarget.user_id == user_id)
        .order_by(Category.name)
    ).all()

    results: list[BudgetSpend] = []
    for target in targets:
        # Transaction outflows: negative amounts only, taken as positive spend.
        txn_outflow = db.scalar(
            select(func.coalesce(func.sum(-Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == target.category_id,
                Transaction.amount < 0,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end,
            )
        )
        # Receipt line items for this category, from receipts uploaded this month.
        receipt_spend = db.scalar(
            select(func.coalesce(func.sum(ReceiptLineItem.amount), 0))
            .join(Receipt, ReceiptLineItem.receipt_id == Receipt.id)
            .where(
                Receipt.user_id == user_id,
                ReceiptLineItem.category_id == target.category_id,
                Receipt.uploaded_at >= month_start,
                Receipt.uploaded_at < month_end,
            )
        )

        spent = Decimal(txn_outflow) + Decimal(receipt_spend)
        limit = target.monthly_limit
        remaining = limit - spent
        percentage = float(spent / limit * 100) if limit > 0 else 0.0

        results.append(
            BudgetSpend(
                category_id=target.category_id,
                category_name=target.category.name,
                category_colour=target.category.colour,
                monthly_limit=limit,
                currency=target.currency,
                spent=spent,
                remaining=remaining,
                percentage=round(percentage, 1),
                over_budget=spent > limit,
            )
        )

    return f"{month_start:%Y-%m}", results
