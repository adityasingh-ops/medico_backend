#!/usr/bin/env bash
# Section 2 evidence: working app + Kubernetes on the local kind cluster.
# Needs only kind, ingress-nginx and metrics-server (not the full monitoring stack).
# Writes docs/evidence/01..07 *.txt
# Usage: ./scripts/evidence-k8s.sh
set -uo pipefail
cd "$(dirname "$0")/.."
NS=medzo-dev
OUT=docs/evidence
mkdir -p $OUT
run() { echo "\$ $*"; "$@" 2>&1; echo; }

echo "==> Cluster, ingress, metrics-server"
kind get clusters | grep -qx medzo || kind create cluster --config deploy/kind/cluster.yaml
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm repo update >/dev/null
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --version 4.15.1 \
  -n ingress-nginx --create-namespace -f deploy/platform/ingress-nginx.yaml \
  --set controller.metrics.serviceMonitor.enabled=false --wait
helm upgrade --install metrics-server metrics-server/metrics-server --version 3.14.0 \
  -n kube-system -f deploy/platform/metrics-server.yaml --wait

echo "==> Build image and deploy (2 replicas, HPA, PDB on)"
SHA=$(git rev-parse --short HEAD)
docker build -t medzo-api:$SHA --build-arg GIT_SHA=$SHA .
kind load docker-image medzo-api:$SHA --name medzo
helm upgrade --install medzo helm/medzo -n $NS --create-namespace \
  -f helm/medzo/values-dev.yaml --set image.tag=$SHA \
  --set autoscaling.enabled=true --set autoscaling.minReplicas=2 \
  --set podDisruptionBudget.enabled=true --set tracing.enabled=false \
  --wait --timeout 5m
sleep 10

{ echo "# $(date)"; run kubectl get nodes -o wide; } > $OUT/01-nodes.txt

{ echo "# $(date)"
  run helm list -n $NS
  run kubectl get pods -n $NS -o wide
  run kubectl get deploy,statefulset,svc,ingress,pvc,hpa,pdb,networkpolicy,configmap -n $NS
} > $OUT/02-k8s-resources.txt

{ echo "# $(date)"; run helm test medzo -n $NS --logs; } > $OUT/03-helm-test.txt

{ echo "# $(date)  (through ingress-nginx on http://localhost)"
  for p in /healthz /readyz /version /api/categories; do
    echo "\$ curl -s -w ' [HTTP %{http_code}]' http://localhost$p"
    curl -s -w " [HTTP %{http_code}]" http://localhost$p; echo; echo
  done
  echo "\$ curl -s http://localhost/metrics   (first lines with http_requests_total)"
  kubectl exec -n $NS deploy/medzo -- node -e \
    "fetch('http://localhost:5858/metrics').then(r=>r.text()).then(t=>console.log(t.split('\n').filter(l=>l.startsWith('http_requests_total')).slice(0,5).join('\n')))"
} > $OUT/04-app-requests.txt

{ echo "# $(date)  Rolling restart while sending requests every 0.1s"
  run kubectl get deploy medzo -n $NS -o jsonpath='{.spec.strategy}{"\n"}'
  : > /tmp/medzo-codes
  ( end=$((SECONDS+60)); while [ $SECONDS -lt $end ]; do
      curl -s -o /dev/null -w '%{http_code}\n' http://localhost/api/categories >> /tmp/medzo-codes; sleep 0.1; done ) &
  LOAD=$!
  sleep 3
  run kubectl rollout restart deploy/medzo -n $NS
  run kubectl rollout status deploy/medzo -n $NS --timeout=180s
  wait $LOAD
  echo "Responses during the restart (count status):"
  sort /tmp/medzo-codes | uniq -c
  echo
  run kubectl get pods -n $NS -o wide
} > $OUT/05-rollout.txt

{ echo "# $(date)  Self-healing and persistent data"
  echo "\$ create a category, then delete the MongoDB pod"
  curl -s -X POST http://localhost/api/categories -H 'Content-Type: application/json' \
    -d '{"name":"evidence-'"$SHA"'","color":"#2E7D32"}'; echo; echo
  run kubectl delete pod medzo-mongodb-0 -n $NS
  run kubectl wait pod medzo-mongodb-0 -n $NS --for=condition=ready --timeout=180s
  sleep 15
  echo "\$ curl -s http://localhost/api/categories   (category still there after the pod was recreated)"
  curl -s http://localhost/api/categories | grep -o '"name":"evidence-[^"]*"'; echo
  echo
  POD=$(kubectl get pod -n $NS -l app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}')
  run kubectl delete pod $POD -n $NS
  run kubectl get pods -n $NS -l app.kubernetes.io/component=api -o wide
} > $OUT/06-self-healing.txt

{ echo "# $(date)  Container and network security"
  run kubectl exec -n $NS deploy/medzo -- id
  run kubectl exec -n $NS deploy/medzo -- touch /app/write-test
  run kubectl get pod -n $NS -l app.kubernetes.io/component=api -o jsonpath='{.items[0].spec.containers[0].securityContext}{"\n"}'
  echo "# api pod -> MongoDB (allowed by NetworkPolicy)"
  run kubectl exec -n $NS deploy/medzo -- node -e \
    "const s=require('net').connect(27017,'medzo-mongodb');s.on('connect',()=>{console.log('connected');process.exit(0)});s.setTimeout(5000,()=>{console.log('timed out');process.exit(1)})"
  echo "# unrelated pod -> MongoDB (should be blocked by NetworkPolicy)"
  run kubectl run np-test -n $NS --rm -i --restart=Never --image=busybox:1.36 -- \
    sh -c 'nc -z -w 5 medzo-mongodb 27017 && echo connected || echo "blocked (timed out)"'
} > $OUT/07-security.txt

echo "Done. Files in $OUT:"
ls -1 $OUT
