from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.seed import DEFAULT_USER_EMAIL

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession) -> User:
    """POC auth bypass: resolve the seeded single user (see AUTH-4 for real auth)."""
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        raise HTTPException(status_code=500, detail="Default user not seeded")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
