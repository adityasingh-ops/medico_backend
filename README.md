# Medzo backend: DevOps project

Medzo is a medicine delivery backend (Express + socket.io + MongoDB, TypeScript). This branch adds
everything needed to build, deploy, release, observe and operate it on Kubernetes.
The app before this work is kept as tag `v0-original`.

- How it works: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Why each choice: [docs/DECISIONS.md](docs/DECISIONS.md)
- Operating it, rollback, failure drills: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Proof it works: [docs/EVIDENCE.md](docs/EVIDENCE.md)

## What changed compared to the original

| Area | Before | After |
|---|---|---|
| Build | `postinstall: tsc`, `tsConfig.json` (breaks on Linux: case-sensitive) | multi-stage Dockerfile, non-root, `tsconfig.json` |
| Shutdown | only SIGINT, so Kubernetes' SIGTERM killed requests | SIGTERM + SIGINT, drains HTTP, sockets, Redis, MongoDB |
| Health | none | `/healthz`, `/readyz` (checks MongoDB), `/version` |
| Chat across pods | in-memory rooms (breaks with 2+ pods) | Redis adapter + sticky ingress cookie |
| Logs | `console.log` text | pino JSON, auth headers redacted |
| Metrics / traces | none | Prometheus `/metrics`, OpenTelemetry traces |
| Tests | none | Jest + Supertest (health, readiness, metrics, feature flag) |
| Risky feature | always on | `FEATURE_AI_PRESCRIPTIONS` flag |
| Delivery | manual | GitHub Actions → GHCR → approval → Argo CD → canary |

## Layout

```
src/                      app (new: app.ts, observability/, routes/opsRoutes.ts, socket/redisAdapter.ts)
tests/                    Jest tests
Dockerfile, docker-compose.yml
helm/medzo/               Helm chart (values.yaml + values-dev.yaml + values-prod.yaml)
deploy/kind/              3-node kind cluster
deploy/platform/          values for ingress, monitoring, Loki, Alloy, Jaeger, Argo
deploy/argocd/            Argo CD Application for prod
.github/workflows/        CI/CD pipeline
scripts/                  platform install, prod secret, traffic generator
docs/                     architecture, decisions, runbook, evidence
```

## Run it

Needs Docker Desktop (8 GB memory), `kind`, `kubectl`, `helm`, `kubectl-argo-rollouts`:

```bash
brew install kind kubectl helm argoproj/tap/kubectl-argo-rollouts
```

### Just the app (no Kubernetes)

```bash
cp .env.example .env    # set JWT_SECRET
docker compose up --build
curl localhost:5858/readyz
open http://localhost:16686        # traces
```

### Local Kubernetes (dev)

```bash
make up          # kind cluster + platform add-ons + build image + helm install + helm test
make smoke       # curl through the Ingress on http://localhost
```

### Prod via GitOps

1. Push this repo to GitHub, make the `medzo-api` package public (or add a pull secret).
2. GitHub → Settings → Environments → `production` → add yourself as required reviewer.
3. Merge to main and approve the `promote` job. This publishes the first image and writes its tag
   into `values-prod.yaml`.
4. Create the secret and register the Argo CD app (`git pull` first to get the deploy commit):
   ```bash
   export MONGO_ROOT_PASSWORD='...' JWT_SECRET='...'
   make prod-secret
   make gitops
   ```
5. From now on every approved merge is rolled out as a canary:
   ```bash
   kubectl argo rollouts get rollout medzo -n medzo-prod --watch
   ```

Note: the `dev` and CI paths use a test Secret from values; never use those values for a real deployment.

## Access

| What | How | Login |
|---|---|---|
| API (through the Ingress) | http://localhost/healthz, http://localhost/version, http://localhost/api/categories | - |
| Grafana (metrics, logs, traces) | `kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80` → http://localhost:3000 | admin / admin (local only) |
| Prometheus (targets, alerts) | `kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090` | - |
| Jaeger | `kubectl port-forward -n observability svc/jaeger-query 16686` | - |
| Argo CD | `kubectl port-forward -n argocd svc/argocd-server 8080:80` | admin / `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' \| base64 -d` |
| Argo Rollouts | `kubectl argo rollouts dashboard` → http://localhost:3100 | - |

## Security controls

- **Image:** multi-stage build, only production dependencies, npm removed, OS packages patched,
  Trivy blocks the pipeline on fixable HIGH/CRITICAL CVEs.
- **Container:** non-root (UID 1000), read-only root file system, all Linux capabilities dropped,
  no privilege escalation, seccomp `RuntimeDefault`, no service account token mounted.
- **Network:** NetworkPolicies: MongoDB and Redis accept traffic only from api pods; api pods only from
  the ingress controller and Prometheus.
- **Secrets:** never in git. Prod reads `existingSecret` created from shell variables
  (`scripts/create-prod-secret.sh`); docker compose reads `.env` (gitignored) and its MongoDB
  is only reachable inside the compose network. Authorization headers
  are redacted from logs. GitGuardian scans every PR.
- **Supply chain:** the image that passed the tests is the one pushed (no rebuild), tagged with the
  commit SHA; chart versions and tool versions are pinned.
- **Release safety:** prod changes need an approval (GitHub environment) and go out as a canary that
  rolls back on errors.

## Known limitations

- MongoDB runs as a single pod with a local volume: no failover and no automated backups.
- Everything runs on one laptop (kind). The control-plane node runs the only ingress controller.
- Canary weights are by pod count (no service mesh), so 25% is approximate.
- ingress-nginx is retired upstream (March 2026); the Gateway API is the long-term replacement.
- Jaeger stores traces in memory; they are lost when its pod restarts.
- Secrets are plain Kubernetes Secrets created by a script, not Sealed Secrets or a vault.
- CORS still allows all origins, as in the original app.
- The PR also contains app features (prescriptions, doctor verification) that were written before
  this work but not yet committed at the baseline; they are in a separate first commit.
- Running the whole platform (Prometheus, Loki, Alloy, Jaeger, Argo CD) next to the app on one 8 GB
  laptop overloaded the kind cluster: etcd readiness failed, probes timed out and Grafana became
  unreachable, so the Grafana, Loki and alert screenshots are missing. On real hardware these would run
  on separate nodes; locally, install only what a demo needs.
- Argo CD and the canary (Argo Rollouts) are configured but were not exercised end to end before the deadline.
- AI assistance (Claude) was used to plan and implement parts of this project.
