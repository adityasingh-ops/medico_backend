# Evidence

Fill this in from your own runs. Every item should point at something real: a link, a command
output or a screenshot taken from this project.

| # | What | How to get it | Link / file |
|---|---|---|---|
| 1 | Original version kept | tag `v0-original` on the commit before the DevOps work | |
| 2 | CI run for a PR (all jobs green) | Actions tab → the PR run | |
| 3 | CI run on main with publish + approved promote | Actions tab | |
| 4 | Image in GHCR tagged with the commit SHA | Packages → medzo-api | |
| 5 | Deploy commit written by CI | `git log -- helm/medzo/values-prod.yaml` | |
| 6 | Argo CD app Synced/Healthy at that commit | Argo CD UI screenshot | |
| 7 | Running version = commit | `curl localhost/version` output | |
| 8 | Successful request through the Ingress | `curl localhost/api/categories` output | |
| 9 | Canary in progress (25%) and finished | `kubectl argo rollouts get rollout medzo -n medzo-prod` | |
| 10 | Bad release aborted by analysis | AnalysisRun Failed + rollout Degraded/aborted output | |
| 11 | Rollback with git revert | revert commit + `/version` after | |
| 12 | Grafana dashboard with traffic | screenshot | |
| 13 | Alert firing during MongoDB drill | Prometheus /alerts or Alertmanager screenshot | |
| 14 | Logs in Loki for one request | Grafana Explore screenshot | |
| 15 | Trace in Jaeger (Express → MongoDB span) | screenshot | |
| 16 | HPA scaling under load | `kubectl get hpa -n medzo-prod -w` output | |
| 17 | Drift corrected by Argo CD | before/after `kubectl get` output | |
