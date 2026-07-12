# Deployment — home server (alyx) dev tier

Pull-based continuous deployment for the **dev** tier on the self-hosted home server
`alyx` (192.168.1.3). A systemd timer polls `origin/main`; on a new commit it hard-resets
the checkout and redeploys the dev stack.

## Topology

- **Shared services** (`/data/docker/docker-compose.shared.yml`): `budget-postgres` and
  `budget-redis`, on the `budget-dev` / `budget-staging` Docker networks. Databases:
  `budget_dev`, `budget_staging`, `budget_prod`.
- **Dev app** (`deploy/docker-compose.dev.yml`): `api`, `worker`, `frontend`. Joins
  `budget-dev`, connects to `budget-postgres` (`budget_dev` DB) and `budget-redis`
  (logical DB index 2). Does **not** run its own Postgres/Redis.
- **Checkout**: `/data/docker/budget-app` (cloned via a read-only GitHub deploy key,
  `~/.ssh/budget_deploy`).
- **Secrets/ports**: `/data/docker/budget-app.dev.env` (server-only, not committed —
  see `budget-app.dev.env.example`).

Dev is served on the LAN at `http://192.168.1.3:8080` (frontend) and
`http://192.168.1.3:8000` (API). Per the environment strategy, dev data is disposable
mock/seed data, so each deploy re-runs migrations and reseeds `budget_dev`.

## How the pipeline works

1. `budget-app-pull.timer` triggers `budget-app-pull.service` every 3 minutes.
2. `pull-deploy.sh` fetches `origin/main`; if HEAD is unchanged it exits (no-op).
3. On a new commit: `git reset --hard origin/main`, then
   `docker compose -p budget-dev --env-file /data/docker/budget-app.dev.env
   -f deploy/docker-compose.dev.yml up -d --build --remove-orphans`, then an image prune.

## First-time install (on alyx)

```bash
# 1. Server-only env file with the shared DB password + ports
cp /data/docker/budget-app/deploy/budget-app.dev.env.example /data/docker/budget-app.dev.env
#    then edit it: set POSTGRES_PASSWORD (from /data/docker/.env)

# 2. Install + enable the timer (system-level; runs as luc90)
sudo cp /data/docker/budget-app/deploy/budget-app-pull.service /etc/systemd/system/
sudo cp /data/docker/budget-app/deploy/budget-app-pull.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now budget-app-pull.timer

# 3. Trigger the first deploy immediately (optional)
sudo systemctl start budget-app-pull.service
journalctl -u budget-app-pull.service -f
```

## Operating

- Status:   `systemctl status budget-app-pull.timer`
- Logs:     `journalctl -u budget-app-pull.service`
- Pause:    `sudo systemctl disable --now budget-app-pull.timer`
- Manual:   `sudo systemctl start budget-app-pull.service`
- Stack:    `docker compose -p budget-dev -f deploy/docker-compose.dev.yml ps`
