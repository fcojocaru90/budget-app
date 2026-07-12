# Budget App

A personal budgeting application: track expenses across multiple sources (bank CSV
imports, scanned receipts), categorise spending, set monthly budgets, and surface the
investable surplus. FastAPI + PostgreSQL backend, React (Vite) frontend, Celery +
Tesseract for asynchronous receipt OCR.

See `../obsidian-vault/Documentation` for the technical spec, environment strategy, and
the Kanban epics that drive the work.

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic v2, `uv`
- **Async/OCR:** Celery + Redis broker, Tesseract (`pytesseract` + Pillow)
- **Frontend:** React, Vite, Tailwind CSS v4, shadcn/ui, Zustand, React Router
- **Infra:** Docker / Docker Compose

## Quick start (full stack)

```bash
docker compose up --build
```

Brings up Postgres, Redis, the API (auto-runs migrations + demo seed), the OCR worker,
and the frontend. Then open:

- Frontend: http://localhost:5173
- API + docs: http://localhost:8000 / http://localhost:8000/docs

Override host ports with `API_PORT` / `FRONTEND_PORT` if 8000/5173 are taken.

## Local development (without Docker for the app code)

```bash
# Backend (needs a reachable Postgres + Redis; see backend/.env.example)
cd backend
uv sync
cp .env.example .env.local   # then edit values
uv run alembic upgrade head
uv run python -m scripts.seed_data     # optional demo data
uv run uvicorn main:app --reload

# OCR worker (needs the Tesseract binary installed, or run it via the Docker image)
uv run celery -A app.celery_app worker --loglevel=info

# Frontend
cd ../frontend
npm install
npm run dev
```

## Project layout

```
backend/    FastAPI app, models, routes, Celery tasks, Alembic migrations, seed script
frontend/   React + Vite app
docker-compose.yml         Local full stack (Postgres + Redis + API + worker + frontend)
docker-compose.shared.yml  Home-server shared Postgres + Redis (dev/staging/prod databases)
init-multi-db.sh           Creates budget_dev / budget_staging databases on first DB init
```

## Configuration

Settings load from `.env.<APP_ENV>` (e.g. `.env.local`) via `pydantic-settings`; only the
loaded file changes per tier, never the variable names. `backend/.env.example` documents
the full set. Secrets are never committed.
