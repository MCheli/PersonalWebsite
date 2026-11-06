SHELL := /bin/bash
.PHONY: help install dev dev-api dev-frontend test test-frontend test-all lint lint-api lint-frontend \
        typecheck build tour og-image resume-pdf check-resume-pdf content-check catalog-check \
        ledger-check pre-commit clean

VENV := api/.venv
PY := $(VENV)/bin/python
NPM := cd frontend && npm

# ---------------------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------------------

install: $(VENV)/bin/pytest frontend/node_modules/.package-lock.json  ## Create api/.venv and install Python + Node deps

$(VENV)/bin/pytest: api/requirements.txt
	cd api && python3 -m venv .venv && .venv/bin/pip install -q --upgrade pip && .venv/bin/pip install -q -r requirements.txt
	@touch $@

frontend/node_modules/.package-lock.json: frontend/package-lock.json
	$(NPM) install --legacy-peer-deps --ignore-scripts --no-audit --no-fund
	@touch $@

# ---------------------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------------------

dev:  ## Run the API (:5000) and the Nuxt dev server (:3000) together
	@trap 'kill 0' EXIT; $(MAKE) dev-api & $(MAKE) dev-frontend & wait

dev-api:  ## Flask API on :5000 (reads api/.env)
	cd api && FLASK_ENV=development ../$(PY) app.py

dev-frontend:  ## Nuxt dev server on :3000 (proxies /api to :5000)
	$(NPM) run dev

# ---------------------------------------------------------------------------------------
# Tests, lint, types, build
# ---------------------------------------------------------------------------------------

test:  ## API tests + repo script tests (pytest from api/)
	cd api && .venv/bin/pytest

test-frontend:  ## Frontend unit tests (vitest run)
	$(NPM) run test:run

test-all: test test-frontend  ## Both test suites

lint: lint-api lint-frontend  ## ruff (api + scripts) and eslint (frontend); fails on findings

lint-api:
	cd api && .venv/bin/ruff check . ../scripts && .venv/bin/ruff format --check . ../scripts

lint-frontend:
	$(NPM) run lint
	frontend/node_modules/.bin/eslint --config frontend/eslint.config.mjs scripts

typecheck:  ## nuxi typecheck (vue-tsc, TypeScript strict)
	$(NPM) run typecheck

build:  ## Production build to frontend/.output (the tour, og-image and resume-pdf use it)
	$(NPM) run build

# ---------------------------------------------------------------------------------------
# Artifacts: screenshots, OG image, resume PDF
# ---------------------------------------------------------------------------------------

tour:  ## Screenshot every route and tour command at 390px and 1440px into artifacts/screens/ (needs make build, or TOUR_BASE_URL)
	node scripts/screenshot_tour.mjs $(TOUR_ARGS)

og-image:  ## Render frontend/public/og.png (1200x630) from content/
	node scripts/og_image.mjs

resume-pdf:  ## Print /resume to frontend/public/Mark-Cheli-Resume.pdf + sidecar (needs make build, or TOUR_BASE_URL)
	node scripts/resume_pdf.mjs

check-resume-pdf:  ## Fail if content/resume.json is newer than the committed PDF
	$(PY) scripts/check_resume_pdf.py

# ---------------------------------------------------------------------------------------
# Content and requirement gates
# ---------------------------------------------------------------------------------------

content-check:  ## Validate content/*.json against content/schemas/ and the cross-field rules
	$(PY) scripts/content_check.py

catalog-check:  ## Diff content/services.json against the live homelab compose file and check public URLs
	$(PY) scripts/check_catalog.py $(CATALOG_ARGS)

ledger-check:  ## Validate docs/requirements/ledger.yaml (ids, statuses, evidence paths)
	$(PY) scripts/ledger_check.py

# Run before committing: everything CI's test job runs (the Docker build/smoke and the tour run in CI only).
pre-commit: lint typecheck test test-frontend build content-check ledger-check catalog-check  ## All gates

# ---------------------------------------------------------------------------------------

clean:  ## Remove build output, caches and tour scratch
	rm -rf frontend/.output frontend/.nuxt frontend/dist artifacts/tmp
	find . -path ./frontend/node_modules -prune -o -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -print0 | xargs -0 rm -rf

help:  ## This list
	@echo "markcheli.com — make targets"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | sed -E 's/^([a-zA-Z0-9_-]+):.*?## (.*)$$/  \1\t\2/' | awk -F'\t' '{ printf "  %-18s %s\n", $$1, $$2 }'
	@echo
	@echo "Variables: TOUR_BASE_URL (tour/resume-pdf against a running server), PLAYWRIGHT_CHROME (browser binary),"
	@echo "           TOUR_ARGS (e.g. --allow-overflow --out artifacts/tmp/screens), CATALOG_ARGS (e.g. --no-urls --offline ../83rr-poweredge)"
