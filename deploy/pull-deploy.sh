#!/usr/bin/env bash
# Pull-based deploy for the Budget App dev tier on the home server (alyx).
# Fetches origin/main; if there's a new commit, hard-resets to it and redeploys
# the dev stack. Idempotent — a no-op when already up to date, so it's safe to
# run on a short interval (see budget-app-pull.timer).
set -euo pipefail

REPO_DIR="${REPO_DIR:-/data/docker/budget-app}"
ENV_FILE="${ENV_FILE:-/data/docker/budget-app.dev.env}"
COMPOSE_FILE="$REPO_DIR/deploy/docker-compose.dev.yml"
PROJECT="${COMPOSE_PROJECT:-budget-dev}"
BRANCH="${DEPLOY_BRANCH:-main}"

log() { echo "$(date -Is) [pull-deploy] $*"; }

cd "$REPO_DIR"

git fetch --quiet origin "$BRANCH"
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "origin/$BRANCH")"

if [ "$local_sha" = "$remote_sha" ] && [ "${FORCE:-0}" != "1" ]; then
    log "up to date ($local_sha)"
    exit 0
fi

log "deploying ${remote_sha} (was ${local_sha}${FORCE:+, forced})"
git reset --hard "origin/$BRANCH"

docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
    up -d --build --remove-orphans

docker image prune -f >/dev/null 2>&1 || true
log "deploy complete at ${remote_sha}"
