import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.dependencies import CurrentUser, DbSession
from app.models import BudgetTarget, Category
from app.schemas import (
    BudgetSummary,
    BudgetSummaryItem,
    BudgetTargetCreate,
    BudgetTargetRead,
    BudgetTargetUpdate,
)
from app.utils.budget_calc import compute_budget_summary

router = APIRouter()


def _get_owned_budget(db: DbSession, user_id: uuid.UUID, budget_id: uuid.UUID) -> BudgetTarget:
    budget = db.get(BudgetTarget, budget_id)
    if budget is None or budget.user_id != user_id:
        raise HTTPException(status_code=404, detail="Budget target not found")
    return budget


def _validate_category(db: DbSession, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=422, detail="Unknown category")


@router.post("", response_model=BudgetTargetRead, status_code=201)
def create_budget(payload: BudgetTargetCreate, db: DbSession, user: CurrentUser):
    _validate_category(db, user.id, payload.category_id)
    budget = BudgetTarget(user_id=user.id, **payload.model_dump())
    db.add(budget)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="A budget target already exists for this category"
        )
    db.refresh(budget)
    return budget


@router.get("", response_model=list[BudgetTargetRead])
def list_budgets(db: DbSession, user: CurrentUser):
    return db.scalars(
        select(BudgetTarget).where(BudgetTarget.user_id == user.id)
    ).all()


@router.get("/summary", response_model=BudgetSummary)
def budget_summary(db: DbSession, user: CurrentUser):
    month, spends = compute_budget_summary(db, user.id)
    return BudgetSummary(
        month=month,
        items=[BudgetSummaryItem(**vars(s)) for s in spends],
    )


@router.put("/{budget_id}", response_model=BudgetTargetRead)
def update_budget(
    budget_id: uuid.UUID, payload: BudgetTargetUpdate, db: DbSession, user: CurrentUser
):
    budget = _get_owned_budget(db, user.id, budget_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: uuid.UUID, db: DbSession, user: CurrentUser):
    budget = _get_owned_budget(db, user.id, budget_id)
    db.delete(budget)
    db.commit()
