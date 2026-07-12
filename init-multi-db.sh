#!/bin/bash
# Runs automatically on first container start (only when the Postgres data
# directory is empty), because it's mounted into /docker-entrypoint-initdb.d.
# POSTGRES_DB already creates budget_prod via the postgres image's own
# entrypoint logic; this script adds the two extra databases per the
# environment strategy doc (budget_dev, budget_staging).
set -e

for DB in budget_dev budget_staging; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE $DB;
    GRANT ALL PRIVILEGES ON DATABASE $DB TO $POSTGRES_USER;
EOSQL
done
