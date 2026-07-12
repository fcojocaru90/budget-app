# Deployment — home server (alyx) dev tier

Push-triggered continuous deployment for the **dev** tier on the self-hosted home server
`alyx` (192.168.1.3). A **GitHub Actions self-hosted runner** on alyx picks up the
`Deploy dev (alyx)` workflow (`.github/workflows/deploy-dev.yml`) on every push to
`main` and redeploys the dev stack. Because the runner reaches GitHub over an outbound
connection, no inbound access to the LAN is needed — the home server stays unexposed.

A systemd polling timer (`budget-app-pull.timer`) is also provided as an offline fallback
but is **disabled** by default now that Actions drives deploys (running both would race).

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

1. A push to `main` starts the `Deploy dev (alyx)` workflow. The job targets
   `runs-on: [self-hosted, alyx]`, so it executes on the runner on alyx.
2. The job runs `FORCE=1 /data/docker/budget-app/deploy/pull-deploy.sh`.
3. `pull-deploy.sh` fetches `origin/main`, `git reset --hard`es to it, then
   `docker compose -p budget-dev --env-file /data/docker/budget-app.dev.env
   -f deploy/docker-compose.dev.yml up -d --build --remove-orphans`, then an image prune.
   (Without `FORCE=1` — e.g. the fallback timer — it no-ops when HEAD is unchanged.)

## Self-hosted runner (on alyx)

Installed at `/data/docker/actions-runner`, registered to `fcojocaru90/budget-app` with
labels `self-hosted,alyx,dev`, running as a systemd service
(`actions.runner.fcojocaru90-budget-app.alyx.service`) under user `luc90`.

- Status:   `sudo systemctl status actions.runner.fcojocaru90-budget-app.alyx.service`
- Re-token: `gh api -X POST repos/fcojocaru90/budget-app/actions/runners/registration-token`

## First-time install (on alyx)

```bash
# 1. Server-only env file with the shared DB password + ports
cp /data/docker/budget-app/deploy/budget-app.dev.env.example /data/docker/budget-app.dev.env
#    then edit it: set POSTGRES_PASSWORD (from /data/docker/.env)

# 2. Install the GitHub Actions self-hosted runner
mkdir -p /data/docker/actions-runner && cd /data/docker/actions-runner
curl -fsSL -o r.tgz https://github.com/actions/runner/releases/download/v2.335.1/actions-runner-linux-x64-2.335.1.tar.gz
tar xzf r.tgz && rm r.tgz
sudo ./bin/installdependencies.sh
# registration token from the workstation: gh api -X POST .../actions/runners/registration-token
./config.sh --url https://github.com/fcojocaru90/budget-app --token <TOKEN> \
  --name alyx --labels self-hosted,alyx,dev --unattended --replace
sudo ./svc.sh install luc90 && sudo ./svc.sh start
```

Deploys then happen automatically on every push to `main`, or manually via the Actions
tab (workflow dispatch) / `gh workflow run deploy-dev.yml`.

## Operating

- Runner:   `sudo systemctl status actions.runner.fcojocaru90-budget-app.alyx.service`
- Runs:     `gh run list --workflow=deploy-dev.yml`  ·  `gh run view <id> --log`
- Redeploy: `gh workflow run deploy-dev.yml`
- Stack:    `docker compose -p budget-dev -f deploy/docker-compose.dev.yml ps`

### Fallback polling timer (disabled by default)

```bash
sudo cp /data/docker/budget-app/deploy/budget-app-pull.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now budget-app-pull.timer   # only if NOT using the runner
```
