"""Celery application (RCT-3).

Broker and result backend come from settings (Redis). Task modules are registered
via ``include`` so the worker picks them up with ``celery -A app.celery_app worker``.
"""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "budget_app",
    broker=settings.celery_broker_url,
    backend=settings.redis_url,
    include=["app.tasks.ocr"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    result_expires=3600,
)


@celery_app.task(name="ping")
def ping() -> str:
    """Trivial task used to verify the worker is wired up (RCT-3 AC)."""
    return "pong"
