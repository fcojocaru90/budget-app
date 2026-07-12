#!/bin/sh
# API container entrypoint: apply migrations (and optionally seed) before starting.
# The worker service overrides the entrypoint, so migrations run once, from the API.
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Applying database migrations..."
    alembic upgrade head
fi

if [ "$SEED_ON_START" = "true" ]; then
    echo "Seeding demo data..."
    python -m scripts.seed_data || echo "Seed skipped/failed (continuing)."
fi

exec "$@"
