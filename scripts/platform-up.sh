#!/usr/bin/env bash
# Installs the cluster add-ons the app depends on. Chart versions are pinned
# so the same command gives the same cluster every time.
# Usage: ./scripts/platform-up.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P=deploy/platform

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# First: it installs the ServiceMonitor/PrometheusRule CRDs the other charts use
echo "==> Prometheus, Alertmanager, Grafana"
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack --version 92.10.1 \
  -n monitoring --create-namespace -f $P/kube-prometheus-stack.yaml

echo "==> ingress-nginx"
# --timeout: image pulls can be slow on a home connection
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --version 4.15.1 \
  -n ingress-nginx --create-namespace -f $P/ingress-nginx.yaml --wait --timeout 10m

echo "==> metrics-server (for the HPA)"
helm upgrade --install metrics-server metrics-server/metrics-server --version 3.14.0 \
  -n kube-system -f $P/metrics-server.yaml

echo "==> Loki, Alloy, Jaeger (logs and traces)"
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install loki grafana/loki --version 7.3.0 -n observability -f $P/loki.yaml
helm upgrade --install alloy grafana/alloy --version 1.13.1 -n observability -f $P/alloy.yaml
kubectl apply -f $P/jaeger.yaml

echo "==> Argo Rollouts (canary) and Argo CD (GitOps)"
helm upgrade --install argo-rollouts argo/argo-rollouts --version 2.43.8 \
  -n argo-rollouts --create-namespace --set dashboard.enabled=true
helm upgrade --install argocd argo/argo-cd --version 10.10.5 \
  -n argocd --create-namespace -f $P/argo-cd.yaml

echo "==> Waiting for the ingress controller"
kubectl wait -n ingress-nginx --for=condition=ready pod \
  -l app.kubernetes.io/component=controller --timeout=180s

echo "Platform ready."
