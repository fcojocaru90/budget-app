from decimal import Decimal

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, DbSession
from app.schemas import (
    AnalyticsSummary,
    CategoryBreakdown,
    CategoryBreakdownItem,
)
from app.utils.analytics_calc import (
    DEFAULT_CURRENCY,
    compute_by_category,
    compute_summary,
    month_bounds,
)

router = APIRouter()

MONTH_PATTERN = r"^\d{4}-\d{2}$"


@router.get("/summary", response_model=AnalyticsSummary)
def analytics_summary(
    db: DbSession,
    user: CurrentUser,
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
):
    start, end, label = month_bounds(month)
    summary = compute_summary(db, user.id, start, end, label)
    return AnalyticsSummary(**vars(summary))


@router.get("/by-category", response_model=CategoryBreakdown)
def analytics_by_category(
    db: DbSession,
    user: CurrentUser,
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
):
    start, end, label = month_bounds(month)
    items = compute_by_category(db, user.id, start, end)
    return CategoryBreakdown(
        month=label,
        currency=DEFAULT_CURRENCY,
        total=sum((c.total for c in items), Decimal(0)),
        items=[CategoryBreakdownItem(**vars(c)) for c in items],
    )
