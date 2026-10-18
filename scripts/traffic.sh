#!/usr/bin/env bash
# Sends steady traffic from inside the cluster so dashboards, the HPA and the
# canary analysis have data. Hits public endpoints only (no login needed).
# Usage: NS=medzo-prod DURATION=300 ./scripts/traffic.sh
set -euo pipefail
NS="${NS:-medzo-prod}"
DURATION="${DURATION:-300}"
URL="http://medzo.$NS:5858"

kubectl run medzo-traffic -n "$NS" --image=busybox:1.36 --restart=Never \
  --labels=medzo-client=true -- \
  sh -c "end=\$((\$(date +%s)+$DURATION)); while [ \$(date +%s) -lt \$end ]; do
           wget -q -O /dev/null $URL/api/categories; wget -q -O /dev/null $URL/; sleep 0.2; done"
echo "Traffic running for ${DURATION}s in $NS. Stop early: kubectl delete pod medzo-traffic -n $NS"
