# Evidence

Every item points at a real run, command output or screenshot from this project.
Text outputs are in [docs/evidence/](evidence/), screenshots in [docs/evidence/screenshots/](evidence/screenshots/).

## CI/CD

| # | What | Evidence |
|---|---|---|
| 1 | Original version kept | baseline commit [`23f045d`](https://github.com/adityasingh-ops/medico_backend/commit/23f045ded719a36e0a1333a05495ce0a8f5406ac) on `main`; all work is in PR #3 |
| 2 | PR pipeline green: typecheck, tests, chart lint, kubeconform, build, Trivy, deploy on kind, helm test, smoke test, GitGuardian | [run 39136553389](https://github.com/adityasingh-ops/medico_backend/actions/runs/39136553389), [screenshot](evidence/screenshots/01-pr-checks-all-green.png), job output in [ci-deploy-test.txt](evidence/ci-deploy-test.txt) |
| 3 | Pipeline blocks a vulnerable image | [run 39130852093](https://github.com/adityasingh-ops/medico_backend/actions/runs/39130852093) (build failed on 26 CVEs), fix and re-scan in [trivy-gate.txt](evidence/trivy-gate.txt) |
| 4 | Image in GHCR tagged with the commit SHA | after merge: `publish` job + Packages → medzo-api |
| 5 | Approved promote writes the release to git | after merge: `promote` job + `git log -- helm/medzo/values-prod.yaml` |

## Working application and Kubernetes (local kind cluster)

| # | What | Evidence |
|---|---|---|
| 6 | 3-node kind cluster (1 control plane, 2 workers), Kubernetes v1.37 | [01-nodes.txt](evidence/01-nodes.txt) |
| 7 | Release deployed; api pods on both workers; MongoDB StatefulSet with bound PVC; Redis; Ingress; HPA (9%/70% CPU); PDB; 3 NetworkPolicies | [02-k8s-resources.txt](evidence/02-k8s-resources.txt) |
| 8 | `helm test` Succeeded from inside the cluster: ready + version `50e0559` | [03-helm-test.txt](evidence/03-helm-test.txt) |
| 9 | Requests through the Ingress on localhost: healthz, readyz, version, /api/categories all HTTP 200; request counted in /metrics | [04-app-requests.txt](evidence/04-app-requests.txt) |
| 10 | Rolling restart under load: 426 requests, all HTTP 200 (zero downtime: maxUnavailable 0, readiness probe, preStop) | [05-rollout.txt](evidence/05-rollout.txt) |
| 11 | MongoDB pod deleted, data still there after restart (PVC); deleted api pod replaced on the other worker | [06-self-healing.txt](evidence/06-self-healing.txt) |

## Release control (prod via Argo CD)

| # | What | Evidence |
|---|---|---|
| 12 | Argo CD app Synced/Healthy at the release commit | screenshot |
| 13 | Canary at 25% and finished | `kubectl argo rollouts get rollout medzo -n medzo-prod` output |
| 14 | Bad release aborted by the analysis | AnalysisRun Failed + rollout aborted output |
| 15 | Rollback with `git revert` | revert commit + `/version` after |
| 16 | Drift corrected by Argo CD | before/after output |

## Observability

| # | What | Evidence |
|---|---|---|
| 17 | Grafana dashboard with traffic | screenshot |
| 18 | Prometheus target UP | screenshot |
| 19 | Alert firing during MongoDB drill | screenshot |
| 20 | Logs for one request in Loki | screenshot |
| 21 | Trace in Jaeger (Express → MongoDB span) | screenshot |
| 22 | HPA scaling under load | `kubectl get hpa -w` output |

## Security

| # | What | Evidence |
|---|---|---|
| 23 | Image scan gate | rows 2-3 |
| 24 | Runs as UID 1000; write to /app fails with "Read-only file system"; capabilities dropped | [07-security.txt](evidence/07-security.txt) |
| 25 | NetworkPolicy: api pod → MongoDB connected; unrelated pod → MongoDB blocked | [07-security.txt](evidence/07-security.txt) |
| 26 | No secrets in git (GitGuardian on every PR) | PR #3 checks |
