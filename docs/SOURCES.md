# Sources and templates used

| Part | Based on |
|---|---|
| Helm chart layout, `_helpers.tpl`, test hook | `helm create` scaffold (Helm v3.16) |
| Dockerfile (multi-stage, non-root, exec CMD) | Node.js Docker best practices – https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md |
| kind cluster with ingress port mapping | kind ingress guide – https://kind.sigs.k8s.io/docs/user/ingress/ |
| CI image build/share between jobs | Docker docs – https://docs.docker.com/build/ci/github-actions/share-image-jobs/ |
| kind in GitHub Actions | https://github.com/helm/kind-action |
| Manifest validation | kubeconform – https://github.com/yannh/kubeconform, CRD schemas from https://github.com/datreeio/CRDs-catalog |
| Canary + Prometheus analysis | Argo Rollouts docs – https://argoproj.github.io/argo-rollouts/analysis/prometheus/ and /features/canary/ |
| Argo CD Application | https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/ |
| Metrics | prom-client README – https://github.com/siimon/prom-client |
| Tracing (no code changes) | OpenTelemetry zero-code JS – https://opentelemetry.io/docs/zero-code/js/ |
| Log shipping | Grafana Alloy "Collect Kubernetes logs" – https://grafana.com/docs/alloy/latest/collect/logs-in-kubernetes/ |
| Loki single binary | https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/ |
| socket.io across pods | https://socket.io/docs/v4/redis-adapter/ |
| Chart versions | pinned from `helm search repo` on 18 Oct 2026 |
