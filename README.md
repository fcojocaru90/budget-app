# Budget App

A personal budgeting application: track expenses across multiple sources (bank CSV
imports, scanned receipts), categorise spending, set monthly budgets, and surface the
investable surplus. FastAPI + PostgreSQL backend, React (Vite) frontend, Celery +
Tesseract for asynchronous receipt OCR.

> 📖 **Full documentation lives in the [project wiki](https://github.com/fcojocaru90/budget-app/wiki).**

## Features

- **Transaction management** — manual entry plus CSV import with configurable column mapping
- **Receipt scanning** — asynchronous OCR (Celery + Tesseract) with line-item extraction and manual correction
- **Categorisation** — predefined and custom colour-coded categories, with bulk assignment
- **Budget tracking** — monthly targets per category, overspend alerts, month-over-month trends
- **Insights** — cost-cutting recommendations and investable-surplus calculation

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic v2, `uv`
- **Async/OCR:** Celery + Redis broker, Tesseract (`pytesseract` + Pillow)
- **Frontend:** React, Vite, Tailwind CSS v4, shadcn/ui, Zustand, React Router
- **Infra:** Docker / Docker Compose

## Quick start

```bash
docker compose up --build
```

Brings up Postgres, Redis, the API (auto-runs migrations + demo seed), the OCR worker,
and the frontend. Then open:

- Frontend: http://localhost:5173
- API + docs: http://localhost:8000 / http://localhost:8000/docs

Override host ports with `API_PORT` / `FRONTEND_PORT` if 8000/5173 are taken.

## Documentation

| Guide | Description |
|---|---|
| [Getting Started](https://github.com/fcojocaru90/budget-app/wiki/Getting-Started) | Full-stack Docker run and local development without Docker |
| [Deployment](https://github.com/fcojocaru90/budget-app/wiki/Deployment) | Deployment model, shared-services topology, and continuous deployment |
| [Technical Specification](https://github.com/fcojocaru90/budget-app/wiki/Overview) | Stack, data models, core features, and API endpoints |
| [Environment Strategy](https://github.com/fcojocaru90/budget-app/wiki/Environments-Overview) | Per-tier database, Redis, networking, secrets, logging, and backup strategy |

See the [wiki home](https://github.com/fcojocaru90/budget-app/wiki) for the full index.
