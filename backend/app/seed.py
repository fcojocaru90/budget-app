"""Idempotent seed data: the single POC user (auth deferred) and default categories."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, User

DEFAULT_USER_EMAIL = "cojocaru.florin.90@gmail.com"

DEFAULT_CATEGORIES = [
    ("Utilities", "#3B82F6"),
    ("Groceries", "#22C55E"),
    ("Travel", "#F59E0B"),
    ("Entertainment", "#A855F7"),
]


def ensure_seed_data(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        user = User(email=DEFAULT_USER_EMAIL)
        db.add(user)
        db.flush()

    existing = set(db.scalars(select(Category.name).where(Category.user_id == user.id)))
    for name, colour in DEFAULT_CATEGORIES:
        if name not in existing:
            db.add(Category(user_id=user.id, name=name, colour=colour))

    db.commit()
    return user
