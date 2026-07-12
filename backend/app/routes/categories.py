import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models import Category
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter()


def _get_owned_category(db: DbSession, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: DbSession, user: CurrentUser):
    category = Category(user_id=user.id, **payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(db: DbSession, user: CurrentUser):
    return db.scalars(
        select(Category).where(Category.user_id == user.id).order_by(Category.name)
    ).all()


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: uuid.UUID, payload: CategoryUpdate, db: DbSession, user: CurrentUser
):
    category = _get_owned_category(db, user.id, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, db: DbSession, user: CurrentUser):
    category = _get_owned_category(db, user.id, category_id)
    db.delete(category)
    db.commit()
