#!/usr/bin/env bash
# Creates the medzo-secrets Secret that values-prod.yaml points to.
# Values come from your shell, so they never end up in git.
# Usage:
#   set MONGO_ROOT_PASSWORD and JWT_SECRET (optional: ANTHROPIC_API_KEY, TWO_FACTOR_API_KEY)
#   in your shell, then: ./scripts/create-prod-secret.sh medzo-prod
set -euo pipefail
NS="${1:-medzo-prod}"
for v in MONGO_ROOT_PASSWORD JWT_SECRET; do
  [ -n "${!v:-}" ] || { echo "Set $v in your shell first" >&2; exit 1; }
done
USER="${MONGO_ROOT_USER:-medzo}"

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic medzo-secrets -n "$NS" \
  --from-literal=MONGO_ROOT_USER="$USER" \
  --from-literal=MONGO_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" \
  --from-literal=MONGODB_URI="mongodb://$USER:$MONGO_ROOT_PASSWORD@medzo-mongodb:27017/medzo?authSource=admin" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  --from-literal=TWO_FACTOR_API_KEY="${TWO_FACTOR_API_KEY:-}" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "Secret medzo-secrets ready in $NS"
