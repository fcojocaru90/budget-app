import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import OcrStatus, TransactionSource

HEX_COLOUR = r"^#[0-9a-fA-F]{6}$"


# --- User (BE-4a) ---


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Category (BE-4a) ---


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    colour: str = Field(pattern=HEX_COLOUR)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    colour: str | None = Field(default=None, pattern=HEX_COLOUR)


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


# --- Transaction (BE-4b) ---


class TransactionBase(BaseModel):
    source: TransactionSource
    amount: Decimal = Field(decimal_places=2)
    currency: str = Field(default="RON", min_length=3, max_length=3)
    description: str = Field(min_length=1, max_length=500)
    transaction_date: date
    category_id: uuid.UUID | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    source: TransactionSource | None = None
    amount: Decimal | None = Field(default=None, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    transaction_date: date | None = None
    category_id: uuid.UUID | None = None


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class TransactionPage(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    page_size: int


# --- CSV import (TXN-2a / TXN-2b) ---


class CsvRowError(BaseModel):
    row: int
    message: str


class CsvImportResult(BaseModel):
    imported: int
    failed: int
    errors: list[CsvRowError]


# --- Receipt + ReceiptLineItem (BE-4c) ---
# ReceiptRead deliberately omits image_url: raw file paths are internal-only.


class ReceiptLineItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(decimal_places=2)
    category_id: uuid.UUID | None = None


class ReceiptLineItemCreate(ReceiptLineItemBase):
    pass


class ReceiptLineItemUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=500)
    amount: Decimal | None = Field(default=None, decimal_places=2)
    category_id: uuid.UUID | None = None


class ReceiptLineItemRead(ReceiptLineItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    receipt_id: uuid.UUID
    created_at: datetime


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    ocr_status: OcrStatus
    ocr_result: dict | None = None
    uploaded_at: datetime
    processed_at: datetime | None = None
    line_items: list[ReceiptLineItemRead] = []


# --- BudgetTarget (BE-4d) ---


class BudgetTargetBase(BaseModel):
    category_id: uuid.UUID
    monthly_limit: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="RON", min_length=3, max_length=3)


class BudgetTargetCreate(BudgetTargetBase):
    pass


class BudgetTargetUpdate(BaseModel):
    monthly_limit: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class BudgetTargetRead(BudgetTargetBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Budget vs. actual summary (BUD-2) ---


class BudgetSummaryItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    category_colour: str
    monthly_limit: Decimal
    currency: str
    spent: Decimal
    remaining: Decimal
    percentage: float
    over_budget: bool


class BudgetSummary(BaseModel):
    month: str  # ISO year-month, e.g. "2026-07"
    items: list[BudgetSummaryItem]


# --- Analytics (ANALYTICS-1, ANALYTICS-2) ---


class AnalyticsSummary(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    surplus: Decimal
    currency: str


class CategoryBreakdownItem(BaseModel):
    category_id: uuid.UUID | None
    category_name: str
    category_colour: str | None
    total: Decimal


class CategoryBreakdown(BaseModel):
    month: str
    currency: str
    total: Decimal
    items: list[CategoryBreakdownItem]
