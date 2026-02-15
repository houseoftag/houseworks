SHELL := /bin/bash

.PHONY: help dev test lint fmt build worker ci

help: ## Show available targets
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(lastword $(MAKEFILE_LIST)) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

dev: ## Run the app locally
	@if [ -f package.json ]; then \
		npm run dev || node src/index.js; \
	elif [ -f src/main.py ]; then \
		python -m src.main; \
	else \
		echo "No dev runner configured. Create src/main.py or add package.json with a dev script."; exit 1; \
	fi

test: ## Run unit tests
	@if command -v pytest >/dev/null 2>&1; then \
		pytest -q; \
	elif [ -f package.json ]; then \
		npm test || node --test; \
	else \
		echo "No tests configured. Add pytest or npm test."; exit 1; \
	fi

lint: ## Run linters and type checks
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check .; \
	elif command -v eslint >/dev/null 2>&1; then \
		eslint .; \
	elif command -v flake8 >/dev/null 2>&1; then \
		flake8 .; \
	elif command -v pyright >/dev/null 2>&1; then \
		pyright; \
	else \
		echo "No linter found (ruff/eslint/flake8/pyright)."; exit 1; \
	fi

fmt: ## Auto-format sources
	@if command -v ruff >/dev/null 2>&1; then \
		ruff format .; \
	elif command -v black >/dev/null 2>&1; then \
		black .; \
	elif command -v prettier >/dev/null 2>&1; then \
		prettier -w .; \
	else \
		echo "No formatter found (ruff/black/prettier)."; exit 1; \
	fi

build: ## Produce a release build or artifact
	@if [ -f package.json ]; then \
		npm run build; \
	elif [ -f pyproject.toml ]; then \
		python -m build || echo "Tip: pip install build"; \
	else \
		echo "No build configured. Provide package.json or pyproject.toml."; exit 1; \
	fi

worker: ## Run worker process
	@if [ -f package.json ]; then \
		npm run worker; \
	else \
		echo "No worker configured. Provide package.json with a worker script."; exit 1; \
	fi

ci: ## Run lint + test + build
	@$(MAKE) lint
	@$(MAKE) test
	@$(MAKE) build
