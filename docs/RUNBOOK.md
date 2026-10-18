# Runbook

Namespace for prod is `medzo-prod`. Port-forwards used below:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80          # Grafana, admin/admin
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090
kubectl port-forward -n observability svc/jaeger-query 16686                # Jaeger UI
kubectl port-forward -n argocd svc/argocd-server 8080:80                    # Argo CD
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl argo rollouts dashboard                                             # Rollouts UI on :3100
```

## Which version is running?

```bash
curl -s localhost/version
kubectl get pods -n medzo-prod -L app.kubernetes.io/version
kubectl argo rollouts get rollout medzo -n medzo-prod
git log --oneline -- helm/medzo/values-prod.yaml      # every prod release is a commit
```

## Rollback

| Situation | Action |
|---|---|
| Canary is failing right now | Nothing: analysis aborts it. Or by hand: `kubectl argo rollouts abort medzo -n medzo-prod` |
| Bad version already at 100% | `git revert <deploy commit>` and push. Argo CD syncs the old tag, Rollouts runs it as a canary |
| Need it back in seconds | `kubectl argo rollouts undo medzo -n medzo-prod` (then fix git, or selfHeal will redo it) |
| A feature is broken, not the whole release | set `FEATURE_AI_PRESCRIPTIONS: "false"` in values, commit; pods restart with the flag off |

After a rollback, check `/version`, the error rate by version panel, and that the AnalysisRun passed.

## Alerts

### high-error-rate
1. Grafana → Medzo API → "Error ratio by version". One version only? It is the release: roll back.
2. Loki: `{namespace="medzo-prod", component="api"} | json | res_statusCode >= 500`
3. Jaeger: search service `medzo-api`, tag `error=true` to see which call failed (MongoDB, Anthropic, 2factor).

### high-latency
1. Latency panel: all routes or one? Jaeger: open a slow trace, find the long span.
2. Event loop lag panel high → CPU bound: `kubectl top pods -n medzo-prod`, check the HPA.

### api-down
1. `kubectl get pods -n medzo-prod`: are api pods Running but not Ready? → `/readyz` fails → MongoDB.
2. Not Running → `kubectl describe pod` events (image pull, OOMKilled, scheduling).

### crashloop
`kubectl logs <pod> --previous -n medzo-prod`. OOMKilled in `describe` → memory limit; startup error → config/secret.

### mongodb-down
```bash
kubectl get pod medzo-mongodb-0 -n medzo-prod
kubectl describe pod medzo-mongodb-0 -n medzo-prod
kubectl get pvc -n medzo-prod
```
The api pods go unready on their own (they are not restarted) and come back when MongoDB is ready.

## Failure drills (for the demo)

| Drill | Command | Expected |
|---|---|---|
| Kill an api pod | `kubectl delete pod -n medzo-prod -l app.kubernetes.io/component=api --wait=false` (one) | other pods serve, new pod Ready |
| MongoDB outage | `kubectl scale sts medzo-mongodb -n medzo-prod --replicas=0` | `/readyz` 503, pods unready not restarted, alert fires; scale back to 1 to recover |
| Drift | `kubectl scale rollout medzo -n medzo-prod --replicas=1` or edit the ConfigMap | Argo CD shows OutOfSync and puts it back |
| Bad release | push a commit that returns 500 on `/api/categories`, approve, run `scripts/traffic.sh` | analysis fails, rollout aborts, stable keeps serving |
| Feature off | set the flag to "false" | `POST /api/prescriptions/extract` → 503 |
| Node down | `docker stop medzo-worker` | pods on that node move to the other worker after ~5 min (or drain to see it immediately) |

## Secrets

```bash
export MONGO_ROOT_PASSWORD='...' JWT_SECRET='...' ANTHROPIC_API_KEY='...'
./scripts/create-prod-secret.sh medzo-prod
```
Changing a value: rerun the script, then `kubectl argo rollouts restart medzo -n medzo-prod`.

## Private image or repo
- GHCR packages are private by default. Either make `medzo-api` public (GitHub → Packages → Settings),
  or create a pull secret and set `imagePullSecrets` in values-prod.yaml.
- If the git repo is private, give Argo CD read access:
  `argocd repo add https://github.com/adityasingh-ops/medico_backend.git --username <user> --password <token>`.
