"""Parse raw OCR text into structured receipt line items (RCT-5).

Heuristic: each line that ends in a price becomes a line item, with the leading
text as the description. Summary/footer lines (total, VAT, payment, change) are
skipped so they don't get counted as purchases.
"""

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

# A price at the end of a line: "2.50", "1,20", "12.99", optionally with a currency token.
_PRICE_RE = re.compile(r"(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:RON|LEI|EUR|USD)?\s*$", re.IGNORECASE)

# Unambiguous receipt metadata — skipped if the phrase appears anywhere in the line.
_SKIP_ANYWHERE = (
    "total", "subtotal", "sub-total", "tva", "vat", "bon fiscal", "cui", "cif",
)

# Ambiguous tokens (e.g. "card" also appears in "Netflix card") — only skipped when
# they are the FIRST word of the line, i.e. a payment/footer summary row.
_SKIP_FIRST_TOKEN = frozenset(
    {
        "cash", "card", "numerar", "change", "rest", "casa", "casier", "client",
        "discount", "reducere", "tel", "str", "nr", "data", "ora",
    }
)


def _is_metadata_line(lowered: str) -> bool:
    if any(phrase in lowered for phrase in _SKIP_ANYWHERE):
        return True
    first_token = lowered.split(maxsplit=1)[0] if lowered.split() else ""
    return first_token in _SKIP_FIRST_TOKEN


@dataclass
class ParsedLineItem:
    description: str
    amount: Decimal


def _to_decimal(raw: str) -> Decimal | None:
    cleaned = raw.strip()
    # Normalise thousands/decimal separators to a plain "1234.56".
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return None
    return value if value > 0 else None


def parse_line_items(raw_text: str) -> list[ParsedLineItem]:
    items: list[ParsedLineItem] = []
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if _is_metadata_line(stripped.lower()):
            continue
        match = _PRICE_RE.search(stripped)
        if not match:
            continue
        amount = _to_decimal(match.group(1))
        if amount is None:
            continue
        description = stripped[: match.start()].strip(" .:-\t")
        if not description:
            continue
        items.append(ParsedLineItem(description=description, amount=amount))
    return items
