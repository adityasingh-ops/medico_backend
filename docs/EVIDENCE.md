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
| 17 | Grafana "Medzo API" dashboard (last 1 hour): steady traffic from 21:07 (`/api/categories` 200, about 2.5 req/s), then from about 21:17 the 5xx ratio rises to 100% and p95/p99 hit the 10 s bucket while the laptop cluster was overloaded (MongoDB unreachable). The dashboard caught a real incident; error ratio and requests are split by version `50e0559` | [screenshot](evidence/screenshots/05-grafana-dashboard.png) |
| 18 | Prometheus scrapes the api through the ServiceMonitor; each series carries `app_kubernetes_io_version="50e0559"` (UP pods; the DOWN ones were restarting while the laptop cluster was overloaded) | [screenshot](evidence/screenshots/04-prometheus-targets.png) |
| 19 | The 5 alert rules from the chart loaded into Prometheus (HighErrorRate, HighLatency, ApiNoReadyPods, PodRestarting, MongoDown), shown in Grafana Alerting; firing during the MongoDB drill not captured | [screenshot](evidence/screenshots/07-alert-rules.png) |
| 20 | Logs in Loki via Grafana Explore: `{namespace="medzo-dev", container="api"}`, 401 lines over the last hour, JSON request logs with `service`, `version: 50e0559`, method, URL (shipped by Alloy) | [screenshot](evidence/screenshots/06-loki-logs.png) |
| 21 | Traces in Jaeger from OpenTelemetry auto-instrumentation: trace list (failing `/readyz` calls marked as errors) and one `GET /healthz` trace with 5 spans (middleware, router, handler) | [list](evidence/screenshots/02-jaeger-traces-list.png), [trace](evidence/screenshots/03-jaeger-trace-detail.png) |
| 19b | MongoDB outage drill: `MedzoMongoDown` and `MedzoApiNoReadyPods` pending after 30s, firing after their 2m `for`; api pods unready but not restarted | [08-alert-drill.txt](evidence/08-alert-drill.txt) |
| 22 | HPA scaling under load | `kubectl get hpa -w` output |

## Security

| # | What | Evidence |
|---|---|---|
| 23 | Image scan gate | rows 2-3 |
| 24 | Runs as UID 1000; write to /app fails with "Read-only file system"; capabilities dropped | [07-security.txt](evidence/07-security.txt) |
| 25 | NetworkPolicy: api pod → MongoDB connected; unrelated pod → MongoDB blocked | [07-security.txt](evidence/07-security.txt) |
| 26 | No secrets in git (GitGuardian on every PR) | PR #3 checks |
