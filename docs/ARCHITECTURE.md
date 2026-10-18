# Architecture

Medzo is a medicine delivery app. Customers use the Expo mobile app (`Medico/`, separate repo),
pharmacies use a store app, and both talk to this backend. This repo is the backend plus
everything needed to build, deploy and run it.

## Components

| Component | What it is | State | Runs as |
|---|---|---|---|
| medzo-api | Express REST API + socket.io chat (TypeScript, Node 22) | none (stateless) | Argo Rollout, 3+ pods, HPA |
| MongoDB | users, stores, medicines, carts, orders, chats | yes (PVC) | StatefulSet, 1 pod |
| Redis | pub/sub bus so socket.io works across api pods | none | Deployment, 1 pod |
| ingress-nginx | entry point, routing, sticky cookie, websocket upgrade | none | on the control-plane node |
| Anthropic API | reads prescription photos (external) | external | behind feature flag |
| 2factor.in | OTP SMS for login (external) | external | - |

## Request path (REST)

```
Mobile app
  │  HTTP  GET http://localhost/api/categories
  ▼
Mac localhost:80 ──(kind extraPortMappings)──► control-plane node hostPort 80
  ▼
ingress-nginx pod  ── matches Ingress "medzo", path "/" ──► sets cookie medzo-route
  ▼
Service medzo (ClusterIP 5858) ── kube-proxy iptables picks a ready endpoint
  ▼
api pod :5858
  ├─ opsRoutes (/healthz /readyz /version /metrics) – not logged, not counted
  ├─ pino-http (JSON log line) → metrics middleware (counter + histogram)
  ├─ authMiddleware (JWT) → controller
  └─ mongoose ──► medzo-mongodb:27017 (headless Service → mongodb-0)
```

The pod is only listed as an endpoint while `/readyz` passes, which needs a live MongoDB
connection. That is how a broken pod is taken out of the request path without being restarted.

## Chat path (socket.io)

```
App ──WebSocket upgrade /socket.io/──► ingress-nginx (proxy timeout 3600s, sticky cookie)
  ──► api pod A  (socket joins room <chatRoomId>)

Store app is connected to api pod B in the same room.
Pod A: io.to(room).emit("new_message") ──► Redis PUBLISH ──► pod B ──► store app
```

Without the Redis adapter, pod A only knows its own sockets, so the store on pod B would never see
the message. The sticky cookie is needed because socket.io starts with HTTP long-polling and every
polling request of one session must reach the same pod.

## Commit to production path

```
git push / PR
  ▼
GitHub Actions  verify (tsc, jest, helm lint, kubeconform)
  ▼             build (docker build, Trivy scan) ─ image tagged with short SHA
  ▼             deploy-test (kind in the runner, helm install, helm test, curl)
  ▼  main only  publish (push the tested image to GHCR)
  ▼             promote ── waits for approval (environment "production")
  ▼                     ── commits image.tag=<sha> to helm/medzo/values-prod.yaml
  ▼
Argo CD (in the cluster) polls git every 60s, sees values-prod.yaml changed, syncs
  ▼
Argo Rollouts: new ReplicaSet, 25% → pause 2m → 50% → pause 2m → 100%
               AnalysisTemplate checks canary 5xx rate and p95 latency in Prometheus
               failure → abort → traffic back on the stable pods
```

Every running pod carries `app.kubernetes.io/version=<sha>`, `/version` returns the same SHA, and
every log line and trace has it, so a running pod can always be traced back to its commit.

## Failure boundaries

| What fails | What users see | What limits the damage | How we notice |
|---|---|---|---|
| One api pod crashes | nothing (other pods serve) | 3 replicas, PDB, readiness | `MedzoPodRestarting` |
| A node dies | brief errors for its in-flight requests | topology spread across 2 workers | node NotReady, pods rescheduled |
| MongoDB down | 503 from every api pod | readiness removes pods, liveness does **not** restart them (so no restart storm) | `MedzoMongoDown`, `MedzoApiNoReadyPods` |
| Redis down | chat messages only reach people on the same pod; REST fine | Redis holds no data, restart is instant | api error logs, pod not ready |
| Anthropic API down/slow | prescription upload fails | feature flag `FEATURE_AI_PRESCRIPTIONS=false` turns it off without a deploy | 5xx on `/api/prescriptions/extract` route |
| Bad release | errors on the canary pods only (25% of traffic) | canary analysis aborts automatically | AnalysisRun Failed, dashboard "by version" |
| Ingress controller down | nothing reachable | single entry point (accepted for local) | everything fails, smoke test |

## Linux and networking details used

- **Signals and PID 1:** the container runs `node` directly (exec form CMD), so it is PID 1 and gets
  SIGTERM. The app now handles SIGTERM (it only handled SIGINT before). `preStop: sleep 5`
  gives kube-proxy and nginx time to remove the pod before shutdown starts.
- **Users and file system:** runs as UID 1000 (`node`), all capabilities dropped, root file system
  read-only, only `/tmp` writable. Logs go to stdout, not files.
- **cgroups:** the memory limit (384Mi) is enforced by the kernel; going over it gets the
  container OOMKilled. No CPU limit, to avoid CFS throttling; the CPU request reserves capacity
  and is what the HPA percentage is based on.
- **DNS:** pods reach `medzo-mongodb` by short name because of the namespace search domain in
  `/etc/resolv.conf` (`medzo-prod.svc.cluster.local`). The headless Service returns the pod IP
  directly.
- **Service routing:** ClusterIP is a virtual IP; kube-proxy writes iptables rules that DNAT it to
  one ready pod IP.
- **Network policy:** MongoDB and Redis accept connections only from api pods; api pods only from
  the ingress and monitoring namespaces.
- **Websockets:** nginx forwards the HTTP `Upgrade` header; the long read timeout keeps idle chat
  connections open.
