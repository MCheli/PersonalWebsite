# markcheli.com — Mark Cheli's personal site

Nuxt 3 SSR terminal on `/` (plus `/resume` and `/projects` as readable pages) and a small Flask API, both reading the same four JSON files in `content/`. Two containers on the homelab, deployed by GitHub Actions → ghcr.io → Watchtower. Personal site, not a product. The terminal is the personality; the job is that a hiring manager on a phone learns who Mark is, what he built and how to reach him in under a minute, without the site ever reading as a job search.

## Read first

- `docs/PRODUCT.md` — what the site is for, the audiences, the voice, the content model, every command and page, the quality bar, and the decisions taken. Source of truth; if code and this file disagree, the file wins until it is changed.
- `docs/ARCHITECTURE.md` — layout, the two containers, content model and schemas, the frontend (blocks, registry, terminal state), the API, SEO, mobile, test harness, CI, ledger schema, security rules.
- `docs/CONTRIBUTING-FEATURES.md` — recipes: change a fact, add a command, a project, a page, an endpoint, sync the catalog, change the look; and the evidence each needs.
- `docs/requirements/ledger.yaml` — every requirement with acceptance criteria, status and evidence. `make ledger-check` validates it.
- `docs/DEPLOYING.md` — how a merge reaches the R630 and how to roll back.
- `docs/REVIEW-2026-11-05.md` — the November 2026 review: what was wrong, what changed, what is left for Mark.

## Rules

- Everything about Mark comes from `content/`. Never hard-code a name, title, URL, count or date in a Vue file, a Python file, a meta tag or a script. One fact, one place.
- **Voice.** Anything written about Mark or his work (`content/*.json`, page copy, meta descriptions, the OG image) is first-person, in his own register, with some craft and never self-absorbed. Two failure modes Mark rejected on 2026-11-05: inflation (scope verbs like "steer", "own", "drive", "lead the transformation"; "executive"; a project named as if it were the job) and blandness ("I'm the director of X. The team handles A, B, C and a few D"). Describe the job by what it is for; categories, not inventories of responsibilities or skills. The builder comes through: software, and welding, 3D printing, old trucks, CAD. The test is a coworker reading it and thinking "yes, that's him", not "he thinks he runs the company" and not "a bot wrote this". `docs/PRODUCT.md`, "Positioning", is the rule; read it before touching `content/`.
- Nothing on the site may read as job-seeking. Mark is not looking and his manager reads it. No "open to", "available", "hire me". `frontend/tests/registry.test.ts` greps every command's output for it.
- A requirement is done only with evidence: a test on the real code path and, for anything visible, a capture from `make tour`. Update `docs/requirements/ledger.yaml` in the same commit as the work.
- Nothing fake. No invented system facts ("Last login", "Status: Operational", fake `ls` sizes) and no success message for something that did not happen (`message` prints "Sent" only on a 2xx from the API).
- The resume carries email, city and public profile links only. No phone, no street address, no compensation.
- Commands live in `frontend/commands/registry.ts` only. `help`, Tab completion, the sitemap and the tour derive from it; nothing is special-cased outside it. A new command also goes in `frontend/commands/registry.json` (a test fails until it does) and, if `deepLink: true`, in `frontend/public/sitemap.xml`.
- Output is structured blocks (`frontend/types/terminal.ts`), never padded `pre` text or HTML strings. Links are real anchors.
- Keep the terminal personality: dark, JetBrains Mono, green prompt, the figlet on wide screens. Do not add a blog, analytics, a database, light mode.
- `make pre-commit` passes before every commit. Visible changes re-run `make tour` and commit the captures. `resume.json` changes re-run `make resume-pdf` (and `make og-image` when basics change) and commit the outputs; CI fails when the PDF is older than the resume.
- Secrets only in environment variables. The API never logs or returns the OpenWeatherMap key or the ntfy token (tests prove it).

## Quick start

```bash
make install        # api/.venv + frontend/node_modules (Node 22 per .nvmrc, Python 3.11 per .python-version)
NUXT_PUBLIC_API_BASE=http://localhost:5000 make dev
                    # Flask :5000 + Nuxt :3000 (make dev-api / make dev-frontend run one). The default apiBase
                    # is the relative /api, which only the homelab nginx serves; there is no dev proxy, so
                    # without the override `weather` and `message` 404 in dev.
make test           # pytest from api/: api/test_app.py + scripts/tests/ (test_ssr.py skips without a build)
make test-frontend  # vitest: frontend/tests/*.test.ts (jsdom, real content)
make lint           # ruff (api + scripts), eslint (frontend + scripts/*.mjs)
make typecheck      # nuxi typecheck (vue-tsc, strict)
make build          # frontend/.output; the tour, resume-pdf and test_ssr.py use it (og-image renders its own HTML)
make tour           # every page and tour command at 390px and 1440px into artifacts/screens/; fails on overflow
make og-image       # frontend/public/og.png from content/, no build needed (commit it)
make resume-pdf     # /resume → frontend/public/Mark-Cheli-Resume.pdf + .json sidecar (commit both)
make check-resume-pdf  # fail if resume.json is newer than the PDF (CI runs it; pre-commit does not)
make content-check  # content/*.json against content/schemas/ plus the cross-field rules
make catalog-check  # services.json vs the live homelab compose file, and every public URL (CATALOG_ARGS="--no-urls" offline)
make ledger-check   # validate docs/requirements/ledger.yaml
make pre-commit     # lint typecheck test test-frontend build content-check ledger-check catalog-check (CI's test job)
```

API env: `api/.env` (`OPENWEATHER_API_KEY`, `NTFY_PUBLISH_TOKEN`, optional `NTFY_URL`, `NTFY_TOPIC`). Without a key `/weather` serves demo data; without a token `/contact` answers 503. Playwright uses `$PLAYWRIGHT_CHROME`, else `/usr/bin/google-chrome`, else its bundled Chromium (`cd frontend && npx playwright install chromium`).

## Layout

```
content/                     resume.json (JSON Resume v1) · projects.json · services.json (homelab catalog) · now.json
content/schemas/             one JSON Schema per file; `make content-check`
frontend/                    Nuxt 3 SSR; content/ → ../content (symlink; the Dockerfile copies the real dir)
  commands/                  one file per command, registry.ts (the only list), registry.json (generated view), execute.ts, blocks.ts
  composables/useTerminal.ts terminal state: entries, input, history, Tab, the pending prompt
  components/                TerminalOutput, TerminalPrompt, CommandBar, Figlet, IdentityHeader, SeoContent
  pages/                     index.vue (terminal), resume.vue, projects.vue · layouts/default.vue (nav)
  types/                     terminal.ts (OutputBlock, Command, CommandContext) · content.ts (the four files)
  utils/                     content.ts (loadContent + derived views) · seo.ts · jsonld.ts · api.ts · figlet.ts
  tests/                     vitest specs · public/ og.png, sitemap.xml, robots.txt, the resume PDF + sidecar
api/                         app.py (Flask), test_app.py, Dockerfile; content/ → ../content (symlink)
scripts/                     ledger_check.py · content_check.py · check_catalog.py · check_resume_pdf.py
                             screenshot_tour.mjs · og_image.mjs · resume_pdf.mjs · lib/browser.mjs · tests/
artifacts/screens/           tour captures the ledger points at (artifacts/tmp/ is scratch, ignored)
docs/                        PRODUCT.md · ARCHITECTURE.md · CONTRIBUTING-FEATURES.md · DEPLOYING.md · REVIEW-2026-11-05.md · requirements/
.github/workflows/           docker-publish.yml: test, tour, build-frontend, build-api, catalog-drift
```

## Content model in one paragraph

`content/resume.json` is JSON Resume v1 (basics, work, education, skills, certificates, interests, `meta.lastModified`) and feeds the `resume`/`about`/`whoami` commands, `/resume`, the PDF, `<title>`, JSON-LD and the API. `content/projects.json` is the portfolio (slug, name, tagline, description, highlights, stack, repo, url, demo, status, started, featured). `content/services.json` is the homelab catalog (host block, profile, categories of services) and every service `name` must equal a `container_name` in `MCheli/83rr-poweredge`'s compose files unless it lists `containers: []` or is `external: true`; `make catalog-check` diffs it against GitHub and CI runs that weekly. `content/now.json` is a dated list. `frontend/utils/content.ts` loads all four once, checks the keys the site cannot live without, and exports `content`; `api/app.py` reads the same files at import.

## History

The site was rebuilt on 2026-11-05 from a review of the old terminal (stale catalog, no resume, "Developer" as the title, unreadable on a phone); the resume took five passes with Mark before the voice was right. `docs/REVIEW-2026-11-05.md` has what was wrong, what shipped (section 6) and what is left for Mark (section 7).

## Local-checkout gotcha

Mark's Mac mini clone had been four commits behind `origin/master` before this pass (security-sweep PRs merged on GitHub, never pulled): `git pull` there before branching. `.claude/worktrees/` is gitignored; worktrees left on disk by earlier sweeps are safe to delete.
