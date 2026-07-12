# Backend image (INFRA-2) — serves the FastAPI app and runs the Celery OCR worker.
# The worker needs the Tesseract binary (RCT-4), so it's installed here.
FROM python:3.12-slim AS base

# System deps: Tesseract (+ Romanian language data) for OCR, and libs Pillow needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-ron \
        libjpeg62-turbo \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

# uv for dependency management, copied from the official distroless image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cached layer), then the app.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev && chmod +x entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# The entrypoint applies migrations/seed when RUN_MIGRATIONS/SEED_ON_START are set
# (API service only); the worker service overrides the entrypoint.
ENTRYPOINT ["./entrypoint.sh"]

# Default: API. The worker service overrides this command in docker-compose.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
