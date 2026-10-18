# Evidence

Every item points at a real run, command output or screenshot from this project.
Text outputs are in [docs/evidence/](evidence/), screenshots in [docs/evidence/screenshots/](evidence/screenshots/).
The cluster evidence was collected on build `50e0559`, an earlier revision of this branch (closed PR #3).
The application code has not changed since; later commits only touched docs, scripts and CI.

## CI/CD

| # | What | Evidence |
|---|---|---|
| 1 | Original version kept | baseline commit [`23f045d`](https://github.com/adityasingh-ops/medico_backend/commit/23f045ded719a36e0a1333a05495ce0a8f5406ac) on `main`; all work is in PR #3 |
| 2 | PR pipeline green: typecheck, tests, chart lint, kubeconform, build, Trivy, deploy on kind, helm test, smoke test, GitGuardian | [run 39136553389](https://github.com/adityasingh-ops/medico_backend/actions/runs/39136553389), [screenshot](evidence/screenshots/01-pr-checks-all-green.png), job output in [ci-deploy-test.txt](evidence/ci-deploy-test.txt) |
| 3 | Pipeline blocks a vulnerable image | [run 39130852093](https://github.com/adityasingh-ops/medico_backend/actions/runs/39130852093) (build failed on 26 CVEs), fix and re-scan in [trivy-gate.txt](evidence/trivy-gate.txt) |

## Working application and Kubernetes (local kind cluster)

| # | What | Evidence |
|---|---|---|
| 4 | 3-node kind cluster (1 control plane, 2 workers), Kubernetes v1.37 | [01-nodes.txt](evidence/01-nodes.txt) |
| 5 | Release deployed; api pods on both workers; MongoDB StatefulSet with bound PVC; Redis; Ingress; HPA (9%/70% CPU); PDB; 3 NetworkPolicies | [02-k8s-resources.txt](evidence/02-k8s-resources.txt) |
| 6 | `helm test` Succeeded from inside the cluster: ready + version `50e0559` | [03-helm-test.txt](evidence/03-helm-test.txt) |
| 7 | Requests through the Ingress on localhost: healthz, readyz, version, /api/categories all HTTP 200; request counted in /metrics | [04-app-requests.txt](evidence/04-app-requests.txt) |
| 8 | Rolling restart under load: 426 requests, all HTTP 200 (zero downtime: maxUnavailable 0, readiness probe, preStop) | [05-rollout.txt](evidence/05-rollout.txt) |
| 9 | MongoDB pod deleted, data still there after restart (PVC); deleted api pod replaced on the other worker | [06-self-healing.txt](evidence/06-self-healing.txt) |

## Observability

| # | What | Evidence |
|---|---|---|
| 10 | Grafana "Medzo API" dashboard (last 1 hour): steady traffic from 21:07 (`/api/categories` 200, about 2.5 req/s), then from about 21:17 the 5xx ratio rises to 100% and p95/p99 hit the 10 s bucket while the laptop cluster was overloaded (MongoDB unreachable). The dashboard caught a real incident; error ratio and requests are split by version `50e0559` | [screenshot](evidence/screenshots/05-grafana-dashboard.png) |
| 11 | Prometheus scrapes the api through the ServiceMonitor; each series carries `app_kubernetes_io_version="50e0559"` (UP pods; the DOWN ones were restarting while the laptop cluster was overloaded) | [screenshot](evidence/screenshots/04-prometheus-targets.png) |
| 12 | The 5 alert rules from the chart loaded into Prometheus (HighErrorRate, HighLatency, ApiNoReadyPods, PodRestarting, MongoDown), shown in Grafana Alerting | [screenshot](evidence/screenshots/07-alert-rules.png) |
| 13 | Logs in Loki via Grafana Explore: `{namespace="medzo-dev", container="api"}`, 401 lines over the last hour, JSON request logs with `service`, `version: 50e0559`, method, URL (shipped by Alloy) | [screenshot](evidence/screenshots/06-loki-logs.png) |
| 14 | Traces in Jaeger from OpenTelemetry auto-instrumentation: trace list (failing `/readyz` calls marked as errors) and one `GET /healthz` trace with 5 spans (middleware, router, handler) | [list](evidence/screenshots/02-jaeger-traces-list.png), [trace](evidence/screenshots/03-jaeger-trace-detail.png) |
| 15 | MongoDB outage drill: `MedzoMongoDown` and `MedzoApiNoReadyPods` pending after 30s, firing after their 2m `for`; api pods unready but not restarted | [08-alert-drill.txt](evidence/08-alert-drill.txt) |

## Security

| # | What | Evidence |
|---|---|---|
| 16 | Image scan gate | rows 2-3 |
| 17 | Runs as UID 1000; write to /app fails with "Read-only file system"; capabilities dropped | [07-security.txt](evidence/07-security.txt) |
| 18 | NetworkPolicy: api pod → MongoDB connected; unrelated pod → MongoDB blocked | [07-security.txt](evidence/07-security.txt) |
| 19 | No secrets in git (GitGuardian on every PR) | PR #3 checks |

## Configured, not run

These are in the repo and validated by `helm lint` / kubeconform in CI, but were not run end to end
before the deadline, so there is no evidence for them:

- Publish to GHCR and the approval-gated `promote` job (they only run on `main`; `values-prod.yaml`
  still has the placeholder tag `1.0.0` until the first promote).
- Argo CD sync of `medzo-prod`, drift correction (`selfHeal`).
- Argo Rollouts canary with the Prometheus AnalysisTemplate, automatic abort, rollback by `git revert`.
- HPA scale-out under load (the HPA is deployed and reads CPU, see row 5, but a scale-up was not captured).
