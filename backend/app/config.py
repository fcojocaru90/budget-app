"""Centralised settings loaded from .env.<tier>, selected by APP_ENV."""

import os
import sys

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_ENV = os.getenv("APP_ENV", "local")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=f".env.{APP_ENV}", extra="ignore")

    app_env: str = APP_ENV
    database_url: str
    redis_url: str
    celery_broker_url: str
    ocr_storage_path: str
    cors_allowed_origins: str = "http://localhost:5173"
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


def _load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        missing = ", ".join(str(e["loc"][0]).upper() for e in exc.errors())
        sys.exit(
            f"Configuration error: missing/invalid settings [{missing}] "
            f"for APP_ENV={APP_ENV!r} — check your .env.{APP_ENV} file "
            f"(see .env.example for the required variables)."
        )


settings = _load_settings()
