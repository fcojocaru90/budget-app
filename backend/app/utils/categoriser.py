"""Rule-based auto-categorisation (RCT-6).

Maps a free-text description (a transaction memo or a receipt line item) to one of
the user's categories by matching keywords against the default category names. This
is the POC baseline; an ML model may replace it later (see TXN-6a).
"""

import uuid
from collections.abc import Iterable

# Keywords are matched case-insensitively against the description. Keys are the
# default category names seeded for every user.
KEYWORD_RULES: dict[str, list[str]] = {
    "Groceries": [
        "kaufland", "lidl", "mega image", "megaimage", "carrefour", "profi", "auchan",
        "penny", "selgros", "cora", "piata", "market", "grocery", "supermarket",
        "milk", "lapte", "bread", "paine", "oua", "eggs", "cheese", "branza",
    ],
    "Utilities": [
        "enel", "engie", "electrica", "e-on", "eon", "distrigaz", "gaz", "apa",
        "apanova", "digi", "rcs", "rds", "orange", "vodafone", "telekom",
        "internet", "utilitati", "factura", "electricity", "water",
    ],
    "Travel": [
        "uber", "bolt", "wizz", "wizzair", "tarom", "blue air", "blueair", "ryanair",
        "hotel", "booking", "airbnb", "stb", "metrorex", "cfr", "train", "flight",
        "taxi", "transport", "parking", "parcare", "fuel", "benzina", "omv", "petrom",
    ],
    "Entertainment": [
        "netflix", "spotify", "hbo", "max", "disney", "youtube", "cinema", "cinema city",
        "steam", "playstation", "xbox", "concert", "bilet", "ticket", "bar", "pub",
        "restaurant", "cafe", "coffee", "starbucks",
    ],
}


def suggest_category_name(description: str) -> str | None:
    text = description.lower()
    for category_name, keywords in KEYWORD_RULES.items():
        if any(keyword in text for keyword in keywords):
            return category_name
    return None


def suggest_category_id(
    description: str, categories: Iterable[tuple[uuid.UUID, str]]
) -> uuid.UUID | None:
    """Return the id of the first user category whose name matches a keyword rule.

    *categories* is an iterable of ``(id, name)`` pairs (the user's own categories),
    so custom categories that happen to share a default name still resolve.
    """
    name = suggest_category_name(description)
    if name is None:
        return None
    for category_id, category_name in categories:
        if category_name.lower() == name.lower():
            return category_id
    return None
