# Decisions and tradeoffs

Each choice, why it fits this app, what else was possible, and when the other option would be better.

## Cluster: kind (3 nodes)
- **Why:** free, runs on a laptop, multi-node so spreading, PDBs and node failure can be shown.
- **Alternatives:** minikube (single node by default), k3d, EKS/GKE.
- **Choose differently when:** real users or public traffic → managed Kubernetes (EKS), where
  the load balancer, storage and node replacement are handled by the cloud.

## Workload types
- **api = Rollout/Deployment:** stateless, any pod can serve any request, so it scales sideways.
- **MongoDB = StatefulSet + PVC:** needs a stable name and its own disk that survives restarts.
  Only one replica: no failover. In production use MongoDB Atlas or a 3-member replica set.
- **Redis = Deployment without volume:** used only for pub/sub, nothing to persist.

## Probes
- **startup** `/healthz`: gives the app up to 60s to connect to MongoDB before liveness starts.
- **liveness** `/healthz`: does *not* check MongoDB. If it did, a database outage would restart every
  api pod at once and make recovery slower.
- **readiness** `/readyz`: checks MongoDB, so pods without a database stop getting traffic.

## Configuration: one Helm chart + per-environment values
- `values.yaml` holds everything shared; `values-dev.yaml` and `values-prod.yaml` hold only the
  differences (image source, replicas, sampling, secrets). No copy-pasted manifests per environment.
- Started from the `helm create` scaffold (helpers, labels, ServiceAccount, test hook).
- **Alternative:** Kustomize overlays. Helm was chosen because the chart needs logic (Rollout vs
  Deployment, optional MongoDB/Redis, monitoring only when the CRDs exist).
- **Secrets:** dev creates a Secret from values; prod points to `existingSecret` created by a script
  from shell variables, so no real secret is in git. Next step would be Sealed Secrets or External
  Secrets with a vault.

## CI: GitHub Actions
- Order: cheap checks first (typecheck, tests, chart lint, schema validation), then build.
- **Build once, promote the same image:** the image tested in kind is the one pushed to GHCR,
  tagged with the commit SHA. Nothing is rebuilt between test and prod.
- **Trivy** fails the build on fixable HIGH/CRITICAL CVEs. Run via a pinned image rather than a
  marketplace action, to limit supply-chain risk in the pipeline.
- **kind inside CI:** proves the chart really installs and the app reaches MongoDB, which `helm lint`
  cannot show.

## CD: GitOps with Argo CD, approval in GitHub
- GitHub's runners cannot reach a cluster on a laptop, so the cluster **pulls** from git instead of
  CI pushing to it.
- The approval step is a GitHub environment rule ("production", required reviewer). After approval,
  CI commits the new tag; git history is the release log, and `git revert` is a rollback.
- `selfHeal: true` means manual `kubectl edit` changes are undone: drift is corrected, not only reported.
- **Alternative:** `helm upgrade` from a self-hosted runner. Simpler, but no drift detection and the
  cluster state is not described in git.

## Release: canary with Argo Rollouts
- 25% → 2 min → 50% → 2 min → 100%, with automatic analysis on the canary pods only
  (5xx rate under 5%, p95 under 1s).
- Without a service mesh, the weight is by pod count, so it is approximate (with 3 pods, 25% is 1 pod
  ≈ 33%). With ingress-nginx traffic routing or Istio it could be exact.
- Sticky cookies keep a user on the same pod, so a user on the canary stays there.
- **Rolling update** (used in dev and CI) is simpler but has no automatic gate.
- **Blue-green** would suit a breaking change that must switch all at once, at the cost of double capacity.
- **Feature flag** `FEATURE_AI_PRESCRIPTIONS` separates "deployed" from "enabled" for the riskiest
  feature (external AI API, cost, privacy).

## Observability
- **Metrics:** prom-client (RED: rate, errors, duration) + default Node metrics. Route label uses the
  pattern (`/api/orders/:id`) to keep the number of series bounded.
- **Logs:** pino JSON to stdout → Alloy → Loki. Authorization headers are redacted.
- **Traces:** OpenTelemetry auto-instrumentation via `NODE_OPTIONS`, no code changes. Shows Express →
  MongoDB → external HTTP spans. Sampling 100% in dev, 20% in prod.
- **Alerts:** error rate, p95 latency, no ready pods, restarts, MongoDB down. Each links to a runbook section.
- **Grafana** has all three data sources (Prometheus, Loki, Jaeger).

## Ingress controller: ingress-nginx
- Used because kind documents it and its annotations cover sticky sessions, timeouts and body size.
- The ingress-nginx project was retired in March 2026 (no more fixes). For a long-lived system the
  move would be the Gateway API (e.g. Envoy Gateway). Kept here because the Ingress resource is
  small and easy to migrate.

## Not done (and why)
- **Terraform:** excluded by the brief.
- **Multiple live environments:** dev runs locally on demand, prod is synced by Argo CD; a permanent
  staging copy would double laptop resources.
- **MongoDB backups:** would add a CronJob running `mongodump` to object storage. Listed as the next step.
