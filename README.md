# markcheli.com

Mark Cheli's personal site: a terminal-style Nuxt 3 app at [www.markcheli.com](https://www.markcheli.com) and a small Flask API at [flask.markcheli.com](https://flask.markcheli.com). Every fact on the site comes from the JSON files in `content/`; both containers ship that directory.

Read first:

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — what the site is for, what it must say, what it must not do. Source of truth for scope.
- [`docs/requirements/ledger.yaml`](docs/requirements/ledger.yaml) — every requirement with status and evidence (a test, and a tour screenshot for anything visible). `make ledger-check` validates it.
- [`docs/DEPLOYING.md`](docs/DEPLOYING.md) — how it gets to the homelab and how to roll back.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/CONTRIBUTING-FEATURES.md`](docs/CONTRIBUTING-FEATURES.md) — how the code is laid out and how to add a command, a project, a page or an endpoint.
- [`CLAUDE.md`](CLAUDE.md) — the agent-facing summary: rules, quick start, layout.

## Layout

```
content/      resume.json (JSON Resume), projects.json, services.json (homelab catalog), now.json
              schemas/ — JSON Schemas; `make content-check` validates
frontend/     Nuxt 3 SSR app (terminal on /, /resume, /projects); content/ is a symlink to ../content
api/          Flask API; content/ is a symlink to ../content
scripts/      the gates: ledger_check.py, check_catalog.py, content_check.py, check_resume_pdf.py,
              screenshot_tour.mjs, og_image.mjs, resume_pdf.mjs (tests in scripts/tests/)
artifacts/screens/   tour captures that the ledger points at (artifacts/tmp/ is scratch, ignored)
docs/         PRODUCT.md, ARCHITECTURE.md, CONTRIBUTING-FEATURES.md, DEPLOYING.md, REVIEW-2026-11-05.md, requirements/ledger.yaml
```

## Quick start

```bash
make install        # api/.venv + frontend/node_modules (Node 22, Python 3.11; see .nvmrc, .python-version)
NUXT_PUBLIC_API_BASE=http://localhost:5000 make dev
                    # Flask on :5000 and Nuxt on :3000; the override points `weather` and `message` at Flask
                    # (the default /api only exists behind the homelab nginx; there is no dev proxy)
make pre-commit     # everything CI's test job runs: lint, typecheck, tests, build, content/ledger/catalog checks
make help           # the full list
```

Other targets you will reach for:

| Target | Does |
|---|---|
| `make test` / `make test-frontend` | pytest (API + scripts) / vitest |
| `make lint` / `make typecheck` | ruff + eslint / `nuxi typecheck` (vue-tsc) |
| `make build` | production build to `frontend/.output` (`tour`, `resume-pdf` and `scripts/tests/test_ssr.py` use it; or set `TOUR_BASE_URL`) |
| `make tour` | every route and command at 390px and 1440px into `artifacts/screens/`; fails on horizontal overflow |
| `make og-image` | regenerates `frontend/public/og.png` from `content/` (commit it) |
| `make resume-pdf` | prints `/resume` to `frontend/public/Mark-Cheli-Resume.pdf` + sidecar (commit both) |
| `make catalog-check` | diffs `services.json` against the live homelab compose file and checks public URLs (`CATALOG_ARGS="--no-urls"` offline) |

Playwright uses `$PLAYWRIGHT_CHROME`, else `/usr/bin/google-chrome`, else its bundled Chromium (`cd frontend && npx playwright install chromium`).

## Frontend

Nuxt 3 SSR, Vue 3, TypeScript strict, JetBrains Mono self-hosted. Port 3000. Image `ghcr.io/mcheli/personal-website`.

Pages: `/` (the terminal: identity line, figlet, command bar, prompt; `?cmd=<command>` auto-runs one), `/resume` (readable and printable; the PDF is generated from it), `/projects` (cards with `#slug` anchors). Commands: `help` `about` `resume` `projects` `services` `now` `contact` `message` `open` `neofetch` `whoami` `weather` `clear` `history` `ls` `exit`, all from `frontend/commands/registry.ts`.

| Variable | Description |
|---|---|
| `NUXT_PUBLIC_API_BASE` | Base URL the browser calls for `weather` and `message` (default `/api`, which the homelab nginx routes to `flask-api`; local dev sets `http://localhost:5000`) |
| `PORT`, `HOST` | Nitro listen address (container: `3000`, `0.0.0.0`) |

## API

Flask 3 + gunicorn. Port 5000. Image `ghcr.io/mcheli/flask-api`. Permissive CORS on every route. Reachable at `flask.markcheli.com` and, through the homelab nginx, at `www.markcheli.com/api/`.

| Endpoint | Returns |
|---|---|
| `/resume` | `content/resume.json` (JSON Resume v1) |
| `/projects` | `content/projects.json` |
| `/services` | `content/services.json` (homelab catalog) |
| `/now` | `content/now.json` |
| `/profile` | name, title, company, location, email, website, flat `links`, host block and the catalog |
| `/weather` | Ashland, MA weather from OpenWeatherMap, cached 10 minutes per worker; demo data without a key |
| `POST /contact` | JSON `{name, email, message, website}` → publishes to ntfy; `website` is a honeypot (non-empty → 200 and dropped). 400 `{error, field}` on validation, 429 after 3 messages per IP per rolling hour (per worker), 503 when `NTFY_PUBLISH_TOKEN` is unset, 502 when ntfy fails |
| `/health`, `/ping` | liveness |

Unknown paths get a 404 JSON body listing the endpoints.

| Variable | Description |
|---|---|
| `OPENWEATHER_API_KEY` | OpenWeatherMap key; unset or `demo-key` returns demo data |
| `NTFY_PUBLISH_TOKEN` | Bearer token for publishing contact messages to ntfy; unset → `/contact` answers 503 |
| `NTFY_URL`, `NTFY_TOPIC` | ntfy base URL and topic (defaults `http://ntfy`, `homelab`) |
| `FLASK_ENV` | `development` enables debug when run with `python app.py` |
| `PORT` | listen port for `python app.py` (default `5000`; gunicorn binds 5000 in the image) |

Neither key nor token is ever written to logs or responses (`api/test_app.py` proves it).

## CI

`.github/workflows/docker-publish.yml`: the `test` job runs the `make pre-commit` list, then both images build; on `main` they push to ghcr.io and Watchtower deploys them. PRs also get a screenshot tour as a downloadable artifact. Mondays a scheduled job runs the catalog check with the URL check enforced, so drift between `services.json` and the homelab fails loudly. Fridays the images rebuild on fresh base images.
