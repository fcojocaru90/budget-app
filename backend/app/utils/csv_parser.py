"""CSV import parsing with user-defined column mapping (BRD, Revolut).

A single statement row can yield multiple transactions: each entry in
``amount_columns`` (e.g. Revolut's Amount + Fee, or BRD's Debit + Credit)
produces one transaction when its cell is non-empty and non-zero.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, Field

from app.models import TransactionSource


class AmountColumn(BaseModel):
    column: str
    sign: int = Field(default=1, ge=-1, le=1)
    description_suffix: str = ""


class ColumnMapping(BaseModel):
    date_column: str
    date_format: str = "%Y-%m-%d"
    description_column: str
    amount_columns: list[AmountColumn] = Field(min_length=1)
    currency_column: str | None = None
    default_currency: str = Field(default="RON", min_length=3, max_length=3)
    decimal_comma: bool = False
    source: TransactionSource
    delimiter: str | None = None


@dataclass
class ParsedTransaction:
    source: TransactionSource
    amount: Decimal
    currency: str
    description: str
    transaction_date: date


@dataclass
class RowError:
    row: int
    message: str


@dataclass
class ParseResult:
    transactions: list[ParsedTransaction] = field(default_factory=list)
    errors: list[RowError] = field(default_factory=list)


def _detect_delimiter(text: str) -> str:
    try:
        return csv.Sniffer().sniff(text[:2048], delimiters=",;\t").delimiter
    except csv.Error:
        return ","


def _parse_amount(raw: str, decimal_comma: bool) -> Decimal | None:
    cleaned = raw.strip().replace(" ", "").replace(" ", "")
    if not cleaned:
        return None
    if decimal_comma:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")
    return Decimal(cleaned)


def parse_csv(content: str, mapping: ColumnMapping) -> ParseResult:
    delimiter = mapping.delimiter or _detect_delimiter(content)
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    result = ParseResult()

    header = reader.fieldnames or []
    referenced = [mapping.date_column, mapping.description_column] + [
        a.column for a in mapping.amount_columns
    ]
    if mapping.currency_column:
        referenced.append(mapping.currency_column)
    missing = [c for c in referenced if c not in header]
    if missing:
        result.errors.append(RowError(row=1, message=f"Missing columns: {', '.join(missing)}"))
        return result

    # DictReader consumes the header, so data starts at line 2
    for line_no, row in enumerate(reader, start=2):
        try:
            transaction_date = datetime.strptime(
                row[mapping.date_column].strip(), mapping.date_format
            ).date()
        except ValueError:
            result.errors.append(
                RowError(
                    row=line_no,
                    message=f"Invalid date {row[mapping.date_column]!r} "
                    f"(expected format {mapping.date_format})",
                )
            )
            continue

        description = row[mapping.description_column].strip()
        if not description:
            result.errors.append(RowError(row=line_no, message="Empty description"))
            continue

        currency = mapping.default_currency
        if mapping.currency_column:
            currency = row[mapping.currency_column].strip() or mapping.default_currency

        row_transactions = []
        row_failed = False
        for amount_col in mapping.amount_columns:
            try:
                amount = _parse_amount(row[amount_col.column], mapping.decimal_comma)
            except InvalidOperation:
                result.errors.append(
                    RowError(
                        row=line_no,
                        message=f"Invalid amount {row[amount_col.column]!r} "
                        f"in column {amount_col.column!r}",
                    )
                )
                row_failed = True
                break
            if amount is None or amount == 0:
                continue
            row_transactions.append(
                ParsedTransaction(
                    source=mapping.source,
                    amount=amount * amount_col.sign,
                    currency=currency,
                    description=description + amount_col.description_suffix,
                    transaction_date=transaction_date,
                )
            )

        if row_failed:
            continue
        if not row_transactions:
            result.errors.append(RowError(row=line_no, message="No non-zero amount in row"))
            continue
        result.transactions.extend(row_transactions)

    return result
