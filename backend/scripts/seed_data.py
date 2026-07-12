"""Seed the database with representative mock data (INFRA-4).

Idempotent by truncate-first: clears transactions, receipts and budget targets, then
inserts a fresh demo dataset for the current month so the dashboard, budgets and
analytics views all have something to show. The single POC user and the default
categories are ensured (not duplicated) via ``ensure_seed_data``.

Run with:  uv run python -m scripts.seed_data
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import (
    BudgetTarget,
    Category,
    Receipt,
    ReceiptLineItem,
    Transaction,
    TransactionSource,
)
from app.seed import ensure_seed_data


def _this_month(day: int) -> date:
    today = date.today()
    return date(today.year, today.month, min(day, 28))


# (source, amount, description, category name or None, day-of-month)
DEMO_TRANSACTIONS = [
    (TransactionSource.BRD, "12000.00", "Consulting invoice — July", None, 1),
    (TransactionSource.BRD, "15.75", "Savings interest", None, 10),
    (TransactionSource.REVOLUT, "-142.50", "Kaufland groceries", "Groceries", 5),
    (TransactionSource.REVOLUT, "-88.20", "Mega Image", "Groceries", 12),
    (TransactionSource.REVOLUT, "-30.00", "Piata Obor", "Groceries", 18),
    (TransactionSource.REVOLUT, "-55.99", "Netflix", "Entertainment", 6),
    (TransactionSource.REVOLUT, "-120.00", "Cinema City + dinner", "Entertainment", 15),
    (TransactionSource.BRD, "-350.50", "ENEL electricity", "Utilities", 4),
    (TransactionSource.BRD, "-89.00", "Digi internet", "Utilities", 9),
    (TransactionSource.REVOLUT, "-250.00", "OMV fuel", "Travel", 8),
    (TransactionSource.REVOLUT, "-80.00", "STB transport pass", "Travel", 3),
    (TransactionSource.REVOLUT, "-200.00", "ATM withdrawal", None, 20),
]

# (category name, monthly limit)
DEMO_BUDGETS = [
    ("Groceries", "500.00"),
    ("Utilities", "400.00"),
    ("Entertainment", "150.00"),
    ("Travel", "300.00"),
]


def seed() -> None:
    with SessionLocal() as db:
        user = ensure_seed_data(db)

        # Truncate demo-owned data (safe to re-run).
        db.execute(delete(ReceiptLineItem))
        db.execute(delete(Receipt).where(Receipt.user_id == user.id))
        db.execute(delete(Transaction).where(Transaction.user_id == user.id))
        db.execute(delete(BudgetTarget).where(BudgetTarget.user_id == user.id))
        db.commit()

        categories = {
            c.name: c.id
            for c in db.execute(
                select(Category.id, Category.name).where(Category.user_id == user.id)
            ).all()
        }

        for source, amount, description, cat_name, day in DEMO_TRANSACTIONS:
            db.add(
                Transaction(
                    user_id=user.id,
                    source=source,
                    amount=Decimal(amount),
                    currency="RON",
                    description=description,
                    transaction_date=_this_month(day),
                    category_id=categories.get(cat_name) if cat_name else None,
                )
            )

        for cat_name, limit in DEMO_BUDGETS:
            if cat_name in categories:
                db.add(
                    BudgetTarget(
                        user_id=user.id,
                        category_id=categories[cat_name],
                        monthly_limit=Decimal(limit),
                        currency="RON",
                    )
                )

        db.commit()
        print(
            f"Seeded {len(DEMO_TRANSACTIONS)} transactions, "
            f"{len(DEMO_BUDGETS)} budget targets, "
            f"{len(categories)} categories for {user.email}."
        )


if __name__ == "__main__":
    seed()
