# One-command local setup. Run `make help` for the list.
CLUSTER   ?= medzo
IMAGE     ?= medzo-api
TAG       ?= dev
DEV_NS    ?= medzo-dev
PROD_NS   ?= medzo-prod

.PHONY: help
help: ## Show targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

.PHONY: test
test: ## Typecheck + unit tests
	npm ci --ignore-scripts
	npm run typecheck
	npm test

.PHONY: cluster
cluster: ## Create the 3-node kind cluster
	kind create cluster --config deploy/kind/cluster.yaml

.PHONY: platform
platform: ## Install ingress, monitoring, logging, tracing, Argo
	./scripts/platform-up.sh

.PHONY: image
image: ## Build the image and load it into kind
	docker build -t $(IMAGE):$(TAG) --build-arg GIT_SHA=$$(git rev-parse --short HEAD) .
	kind load docker-image $(IMAGE):$(TAG) --name $(CLUSTER)

.PHONY: dev
dev: image ## Deploy the local image to medzo-dev with Helm
	helm upgrade --install medzo helm/medzo -n $(DEV_NS) --create-namespace \
	  -f helm/medzo/values-dev.yaml --set image.tag=$(TAG) --wait --timeout 5m
	helm test medzo -n $(DEV_NS)

.PHONY: prod-secret
prod-secret: ## Create the prod Secret (outside git) from your shell env
	./scripts/create-prod-secret.sh $(PROD_NS)

.PHONY: gitops
gitops: ## Register the medzo-prod Argo CD Application
	kubectl apply -f deploy/argocd/medzo-prod.yaml

.PHONY: up
up: cluster platform dev ## Everything for a fresh laptop

.PHONY: smoke
smoke: ## Call the app through the Ingress
	curl -sf http://localhost/healthz && echo
	curl -sf http://localhost/version && echo

.PHONY: down
down: ## Delete the cluster
	kind delete cluster --name $(CLUSTER)
