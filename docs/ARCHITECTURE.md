# markcheli.com — Architecture

How the code is put together and the rules that keep it that way. What the site *is* lives in `docs/PRODUCT.md`; what is required and proven lives in `docs/requirements/ledger.yaml`. Last reviewed 2026-11-05.

## Stack

- **Frontend** `frontend/`: Nuxt 3 (SSR, Nitro), Vue 3 `<script setup lang="ts">`, TypeScript strict, `@fontsource/jetbrains-mono` (self-hosted). ESLint via `@nuxt/eslint-config`; `nuxi typecheck` (vue-tsc 3 on TypeScript 5.9). Node 22 (`.nvmrc`, the image, CI).
- **API** `api/`: Flask 3, flask-cors, requests, python-dotenv, gunicorn (2 workers in the image). Python 3.11 (`.python-version`, the image, CI). ruff for lint and format. `api/requirements.txt` is the pinned lockfile compiled from `requirements.in`.
- **Content** `content/`: four JSON files and a JSON Schema per file. No database, no CMS.
- **Scripts** `scripts/`: Python gates (`ledger_check.py`, `content_check.py`, `check_catalog.py`, `check_resume_pdf.py`) and Playwright scripts (`screenshot_tour.mjs`, `og_image.mjs`, `resume_pdf.mjs`, sharing `lib/browser.mjs`). Playwright is a frontend devDependency; the scripts resolve it from `frontend/node_modules`.
- **Runtime**: two Docker images built from the repo root, deployed by Watchtower on the homelab R630. `docs/DEPLOYING.md`.

## Layout

```
content/
  resume.json        JSON Resume v1: basics, work, education, skills, certificates, languages, interests, meta
  projects.json      { updated, projects: [ {slug, name, tagline, description, highlights, stack, repo, url?, demo?, status, started, featured} ] }
  services.json      { updated, host, categories: [ {id, title, lanOnly?, services: [ {name, url?, description, repo?, containers?, external?, compose?, lanOnly?} ]} ] }
  now.json           { updated, items: [string] }
  schemas/           services/projects/now (draft-07, written here); resume (the vendored JSON Resume v1.0.0 schema, draft-04)
frontend/
  nuxt.config.ts     security headers, self-hosted font css, runtimeConfig.public.apiBase ('/api')
  app.vue            html lang, viewport, favicon, title template; <NuxtLayout><NuxtPage/>
  layouts/default.vue  the site nav (~, resume, projects, github, linkedin) from content
  pages/             index.vue (the terminal) · resume.vue (readable + print css) · projects.vue (cards with id=slug)
  components/        IdentityHeader · Figlet · SeoContent · TerminalOutput · TerminalPrompt · PromptSegments · CommandBar
  commands/          registry.ts (the list) · registry.json (generated view) · execute.ts · blocks.ts · one file per command
  composables/useTerminal.ts   terminal state
  types/             terminal.ts (OutputBlock, Command, CommandContext, PendingPrompt) · content.ts (the four files)
  utils/             content.ts (loadContent, derived views) · seo.ts · jsonld.ts · api.ts · figlet.ts
  assets/css/terminal.css      palette as CSS variables, global rules, print rules
  public/            og.png · sitemap.xml · robots.txt · favicon.png · Mark-Cheli-Resume.pdf (+ .pdf.json sidecar)
  tests/             vitest: commands, components, content, message, registry, seo, useTerminal (+ helpers.ts, setup.ts)
  content -> ../content        symlink (dev); the Dockerfile replaces it with a copy
api/
  app.py             the whole API · test_app.py · pytest.ini (also runs ../scripts/tests) · Dockerfile · ruff.toml
  content -> ../content        symlink (dev); the Dockerfile replaces it with a copy
scripts/             the gates and the Playwright scripts; tests/ (pytest, incl. test_ssr.py against the build)
artifacts/screens/   tour captures the ledger points at (artifacts/tmp/ is scratch, gitignored)
docs/                PRODUCT.md · this file · CONTRIBUTING-FEATURES.md · DEPLOYING.md · REVIEW-2026-11-05.md · requirements/ledger.yaml
.github/             workflows/docker-publish.yml · dependabot.yml (docker, github-actions, npm) · PULL_REQUEST_TEMPLATE.md
Makefile             every command an agent or Mark runs; `make help` lists them
```

## The two containers

| Container | Built from | Serves | Port |
|---|---|---|---|
| `personal-website` (`ghcr.io/mcheli/personal-website`) | `frontend/Dockerfile`, context = repo root | Nuxt SSR: `/`, `/resume`, `/projects`, `public/` through Nitro | 3000 |
| `flask-api` (`ghcr.io/mcheli/flask-api`) | `api/Dockerfile`, context = repo root | JSON content endpoints, `/weather`, `POST /contact` | 5000 |

Both builds run from the repo root so `COPY content/` works: each Dockerfile does `rm -f ./content` (the dev symlink) and then `COPY content/ ./content/`. Both images run as non-root (`nuxtjs` / `appuser`), carry no curl, npm or npx, and answer a HEALTHCHECK (`wget --spider /` and `GET /health`). The frontend image serves `.output/public` through Nitro itself; there is no symlink hack. `.github/workflows/docker-publish.yml` builds both on every PR (smoke-tested, not pushed) and pushes on `main`; Watchtower on the R630 pulls `:latest`. The homelab nginx proxies `www.markcheli.com` → `personal-website:3000`, `flask.markcheli.com` → `flask-api:5000`, and `www.markcheli.com/api/` → `flask-api` (83rr-poweredge #31), which is why the frontend's default `apiBase` is the relative `/api`. Rollback and the after-deploy checks are in `docs/DEPLOYING.md`.

## Content model

`content/` is the only place a fact about Mark lives. `docs/PRODUCT.md`, "Content model", says what each file holds and which surfaces render it.

- `frontend/content` and `api/content` are symlinks to `../content`, so `import resumeJson from '~/content/resume.json'` and `Path(__file__).parent / "content"` resolve the same files in dev, in tests and in the image (where the symlink has been replaced by a copy).
- `frontend/utils/content.ts` imports the four files, runs `validateResume` / `validateProjects` / `validateCatalog` / `validateNow` (required keys, unique slugs and service names) and exports `content: SiteContent`, validated once at module load, which under SSR is build time. A broken file fails the build and the test run with `content/<file>: missing required key "..."` instead of a blank page. The same module holds the derived views every renderer shares: `featuredFirst`, `publicServices`, `containerCount`, `serviceCount`, `currentWork`, `previousWork`, `profileByNetwork`, `locationLine`, `serviceHref`, `formatDate`, `dateRange`, `siteUrl`.
- `api/app.py` reads the same four files at import into `CATALOG`, `RESUME`, `PROJECTS`, `NOW` (one copy per gunicorn worker; content only changes with a deploy).
- `content/schemas/` is the stricter check: `make content-check` (`scripts/content_check.py`) validates each file against its schema (`additionalProperties: false` on the three written here) and then the rules a schema cannot say: unique slugs and service names, `repo` under `github.com/MCheli/`, `updated` is `YYYY-MM-DD`, other dates `YYYY` or `YYYY-MM`, `meta.lastModified` is a real date. `$comment` keys are documentation and are stripped before the resume schema sees them.
- `services.json` is also checked against the world: `make catalog-check` (`scripts/check_catalog.py`) downloads `docker-compose.yml` and every per-entry `compose` override from `MCheli/83rr-poweredge` main, collects `container_name` values and diffs them against the catalog (a `name` must be a container unless `containers: [...]` lists the real ones, `[]` meaning "not a container", or `external: true`), then HEAD/GETs every public https url in `services.json` and `projects.json` (`lanOnly` skipped; 401/403 count as alive behind Cloudflare Access). `--no-urls`, `--urls-warn-only`, `--offline <checkout>` for dev and CI.
- Generated from content and committed: `frontend/public/og.png` (`make og-image`), `frontend/public/Mark-Cheli-Resume.pdf` plus its sidecar `{generatedFrom, generatedAt}` (`make resume-pdf`). `scripts/check_resume_pdf.py` fails CI when `meta.lastModified` is newer than `generatedFrom`.

Identity lives only in `resume.json` (`basics` plus `work[0]`): the frontend, the API's `/profile`, `scripts/og_image.mjs` and the catalog URL check all read it from there. `services.json` holds the host and the catalog, nothing about Mark.

## Frontend

### Output is blocks

`frontend/types/terminal.ts` defines `OutputBlock`: `text` (with an optional `tone`: muted, success, info, error), `heading`, `rule`, `list` (items are `Inline[]`), `kv` (rows of key → `Inline[]`), `table` (rows of `{ name: Inline, description?, detail?: Inline[] }`: the catalog), `link`, `figlet`, `blank`. An `Inline` is a string or `{ href, label }`. `frontend/commands/blocks.ts` has the constructors (`text`, `muted`, `success`, `error`, `heading`, `kv`, `table`, `list`, `link`, `a`, `blank`, `figlet`) and `blocksText` / `blockHrefs` for tests. `components/TerminalOutput.vue` is the only renderer: real `<a>` elements (internal paths stay in the tab, everything else opens a new one with `rel="noopener noreferrer"`), text interpolated and therefore escaped, `kv` and `table` rows that stack on narrow screens and align in columns from 640px (the table's name column is a fixed 23ch so every category lines up). No `v-html`, no padded strings, no regex linkifying.

### One registry

`frontend/commands/registry.ts` exports `commands`, the ordered list `help` prints. Everything else derives from it: `commandNames()`, `findCommand()` (names and aliases, case-insensitive), `completions()` (commands, aliases and every `open` target), `suggest()` (closest name within Levenshtein distance 2), `tourCommands()` (entries with `tour: true`) and `deepLinkCommands()` (`deepLink: true`). A `Command` is `{ name, aliases?, description, usage?, longDescription?, deepLink?, tour?, run(args, ctx) }`; `run` returns blocks or a promise of them and may call `ctx.print` to emit output early.

`frontend/commands/registry.json` is a generated view (`{ tour: [...], deepLink: [...] }`) for `scripts/screenshot_tour.mjs`, which cannot import TypeScript. `tests/registry.test.ts` fails when it drifts, when `public/sitemap.xml` does not list exactly the `deepLink` commands, or when any command's output contains a banned string (the fake system facts, job-hunt wording).

### execute.ts

`execute(input, ctx)` is pure: `parseInput` lowercases the first word and splits the rest; a known command runs; otherwise `resolveOpenTarget(content, name)` (`commands/open.ts`) checks whether the word is a shortcut (`linkedin`, `github`, `resume-pdf`), a project slug or a service name, and if so calls `ctx.open(url)` and prints "Opening …"; otherwise "command not found: X" plus "did you mean 'Y'?" when `suggest` finds one, else a pointer at `help`. Every side effect goes through `CommandContext` (`open`, `clear`, `print`, `prompt`, `fetchWeather`, `sendMessage`, `history`), so the same function runs under vitest, SSR and in the browser.

### useTerminal

`frontend/composables/useTerminal.ts` holds the state and nothing DOM-shaped: `entries` (each `{ command, prompt?, blocks }`; `command` is empty for the banner), `typed` (this session's history), `input`, `busy`, `pending`. `run(raw)` records the line, runs `execute`, appends the blocks to the last entry (unless the command cleared the screen). `typeAndRun(raw)` types a line character by character (`typingDelay`, 30 ms from the page, 0 under `prefers-reduced-motion` or in tests), pauses four characters' worth, then calls `run`; `busy` is true throughout so the input is read-only and the chips are disabled. A chip tap calls it; `runDeepLink(raw)` calls it for a *known* command and ignores an unknown `?cmd=`. Up/Down walk `typed` and restore the draft; `complete()` (Tab) completes to the unique match or the common prefix, aware of the argument pools for `help`, `projects` and `open`; `cancelInput()` (Ctrl+C) drops the line.

`pending: PendingPrompt | null` is how an interactive command asks a question. `ctx.prompt(label)` returns a promise, sets `pending = { label, onAnswer, onCancel }` and frees the input; the next Enter goes to `answer()` instead of `execute`, which records `{ command: <answer>, prompt: label }` and resolves the promise. Ctrl+C rejects it with `PromptCancelled`. While `pending` is set, history, Tab and the command bar are inert. `commands/message.ts` uses it three times (name, email, message), re-asks on local validation failure, and prints "Sent — I'll reply to <email>." only when `ctx.sendMessage` returns `{ ok: true }`.

### Components and pages

- `IdentityHeader.vue`: name, label, location and summary from `resume.json`, visible and server-rendered. The first thing on `/`.
- `Figlet.vue`: the `MARK CHELI` art (`utils/figlet.ts`) in a `pre` shown from 640px; below that the name as large text. Used by the `figlet` block (the banner, `neofetch`).
- `SeoContent.vue`: everything the commands can print, as plain HTML in an `sr-only` section (visually hidden, never `display: none`).
- `TerminalOutput.vue`, `PromptSegments.vue` (the Powerlevel10k rainbow prompt: `user` from `promptUser(resume)`, `~/<host>` from the catalog, `main`; powerline arrows are CSS border triangles, `aria-hidden`), `TerminalPrompt.vue` (the two-line prompt: segments, then the green `❯` and the input; a question label replaces both while a command waits; the input has `font-size: max(1rem, 16px)`, `autocapitalize`/`autocorrect` off, `spellcheck=false`, `enterkeyhint="go"`; emits submit/up/down/tab/clear/cancel), `CommandBar.vue` (the six chips `about projects resume services contact help`; `position: fixed` at the bottom under 640px, under the prompt above; disabled while busy or a prompt is pending).
- `pages/index.vue`: wires the pieces. Injects `window.open`, `createApi($fetch, config.public.apiBase)` and the typing delay into `useTerminal`; prints the banner on load (so it is in the SSR HTML); echoes each command under the same `PromptSegments` and a yellow command line; runs `?cmd=` after mount; a chip or deep link scrolls the prompt into view, types, runs, then scrolls the echoed command line to the top of the viewport (`scrollToLastCommand`); Enter does the same for a command and keeps the end of the page in view for an answer; a `mouseup` listener focuses the input unless text is selected (removed on unmount); a `ResizeObserver` measures the fixed command bar so the page reserves room for it; sets `data-tour-ready` when done. `useHead(pageHead(...))` plus the JSON-LD script.
- `pages/resume.vue`: the readable resume from `resume.json` (newest work first, education, certificates, skills by group, interests, links, `meta.lastModified` in the footer, "Download PDF" → `/Mark-Cheli-Resume.pdf`); a photo when `basics.image` is set; a print stylesheet in the same file (black on white, no chrome).
- `pages/projects.vue`: cards from `featuredFirst(projects)`, each `<article :id="slug">` so `/projects#tallied` works.
- `layouts/default.vue`: the nav line; hidden in print.

### SEO helpers and the API client

- `utils/seo.ts`: `pageHead(resume, { path, title?, description? })` builds `<title>` (`"<name> — <label>"` on `/`, `"<Page> — <name>"` elsewhere), description (basics.summary by default), canonical, OG and Twitter tags with `og:image` = `<site>/og.png` (1200×630).
- `utils/jsonld.ts`: `personJsonLd(resume)` (name, url, email, jobTitle from the current work entry, worksFor, address, sameAs from profiles, image when set) and `websiteJsonLd`; `homeJsonLd` = both in a `@graph`, `resumeJsonLd` = the Person.
- `utils/api.ts`: `createApi(fetcher, apiBase)` → `{ fetchWeather, sendMessage }`. `sendMessage` posts `{ name, email, message, website: '' }` to `<apiBase>/contact` and turns a thrown non-2xx into `{ ok: false, status, error }` (reading ofetch's `response.status` and `data.error`). Tests hand in a plain function instead of `$fetch`.

## The API

`api/app.py`, one file. Permissive CORS on every route (`flask_cors.CORS(app)`).

| Method and path | Returns |
|---|---|
| `GET /health`, `GET /ping` | liveness, timezone-aware timestamps |
| `GET /resume` | `content/resume.json` |
| `GET /projects` | `content/projects.json` |
| `GET /services` | `content/services.json` |
| `GET /now` | `content/now.json` |
| `GET /profile` | name, title, company, location, email, website from the catalog `profile`; a flat `links` map; `host`; `categories`; `service_count` |
| `GET /weather` | Ashland, MA from OpenWeatherMap, shaped for the `weather` command; demo payload when `OPENWEATHER_API_KEY` is unset or `demo-key` |
| `POST /contact` | `{ok: true}` after publishing to ntfy; `400 {error, field}`, `429`, `503`, `502` otherwise |
| anything else | `404 {error, available_endpoints}`; `test_404_handler` compares the list to `app.url_map` |

- **Weather cache.** A module-level `{fetched_at, payload}` guarded by a lock; `WEATHER_CACHE_TTL = 600`. One upstream call per worker per ten minutes instead of one per visitor; failures are not cached. The response carries `cached: true|false`.
- **Contact flow.** Body must be a JSON object. A non-empty `website` (the honeypot the terminal always sends empty) returns `{ok: true}` and sends nothing, so a bot cannot tell it was caught. Then `validate_contact`: name 1–100, email ≤ 254 matching `EMAIL_RE`, message 10–2000. Then the per-IP limit: `client_ip()` is `X-Real-IP`, else the first `X-Forwarded-For` hop, else `remote_addr`; `_contact_hits` is a module-level `{ip: [monotonic timestamps]}`, 3 per rolling hour per worker. Then `NTFY_PUBLISH_TOKEN` must be set (503 and a logged error otherwise; never a silent drop). Then `POST {NTFY_URL}/{NTFY_TOPIC}` with `Authorization: Bearer`, `Title: Website message from <name>`, `Tags: envelope`, `Priority: 4`, body = message plus `From: <name> <email>`; an upstream failure is 502. Nothing is stored.
- **Redaction.** `redact_api_key()` replaces `appid=…`, the weather key and the ntfy token with `REDACTED` before anything reaches a log line; exception handlers log the type and the redacted message, never a traceback. `api/pytest.ini` turns `DeprecationWarning`s from `app` into errors.

## SEO and crawlers

- `/` server-renders `IdentityHeader` (visible) and `SeoContent` (sr-only: about, work, projects, services, now, links); `scripts/tests/test_ssr.py` fetches the built server with no JavaScript and asserts the title, every project name, every service name, the JSON-LD Person, no `fonts.googleapis.com`, and the security headers.
- JSON-LD on `/` (Person + WebSite) and `/resume` (Person), built from `resume.json`; `tests/seo.test.ts` parses it.
- `public/sitemap.xml` lists `/`, `/resume`, `/projects` and `/?cmd=<name>` for every `deepLink` command; `tests/seo.test.ts` compares it to the registry. `public/robots.txt` allows everything and names the sitemap.
- `og:image` and `twitter:image` are `/og.png`, rendered by `scripts/og_image.mjs` from `content/` (and `basics.image` when set) and committed.
- Security headers come from `nuxt.config.ts` `routeRules`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, a CSP of `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` (a full CSP waits on a nonce for Nuxt's inline hydration script), `Referrer-Policy`, `Permissions-Policy`.

## Mobile

The bar is 390px with no horizontal scroll and every command reachable without a keyboard (`docs/PRODUCT.md`, "Quality bar").

- Layout lives in CSS, not in strings: blocks wrap, `kv` rows stack under 640px, long URLs get `overflow-wrap: anywhere`.
- The one fixed-column thing is the figlet, and it renders only from 640px; below that the name is text (`Figlet.vue`).
- The command bar is fixed to the bottom under 640px; `pages/index.vue` reserves its measured height so the prompt is never under it. Tapping a chip on a coarse pointer does not focus the input, so the keyboard stays down.
- The input is ≥ 16px so iOS does not zoom; autocorrect and autocapitalize are off; `enterkeyhint="go"`.
- The breakpoint is 640px everywhere (`terminal.css`, the components, the pages). `make tour` fails on `scrollWidth > innerWidth` at 390px.

## Test harness

| Gate | What it runs |
|---|---|
| `make test` | `pytest` from `api/` (`api/pytest.ini`): `api/test_app.py` (endpoints, CORS, weather cache and redaction, the whole contact flow with `requests.post` mocked, the 404 list vs `url_map`) and `scripts/tests/` (`test_ledger_check`, `test_content_check`, `test_check_catalog` with fixture compose text and an optional local checkout, `test_check_resume_pdf`, `test_screenshot_tour` against a fixture site, `test_ssr` against `frontend/.output`, skipped when there is no build). |
| `make test-frontend` | vitest + `@vue/test-utils`, jsdom, real content (`tests/helpers.ts` deep-copies it so a test can change a value and see it rendered). `commands` (every command's blocks), `registry` (the lists, completion, suggestion, execute, the banned-string grep), `useTerminal` (history, Tab, deep links, empty Enter), `message` (the three-question flow, Ctrl+C, never "Sent" without a 2xx), `components` (blocks render as anchors and escaped text, chips run commands, the sr-only block, the mobile input attributes), `content` (validation errors and derived views), `seo` (sitemap vs registry, robots, JSON-LD, head tags). |
| `make lint`, `make typecheck` | ruff check + format on `api/` and `scripts/`; eslint on `frontend/` and `scripts/*.mjs`; `nuxi typecheck`. |
| `make build` | `nuxt build` → `frontend/.output`. A broken content file fails here. |
| `make tour` | `scripts/screenshot_tour.mjs`: starts the built server (or `TOUR_BASE_URL`), captures `home`, `cmd-<name>` for each `tour` command in `registry.json`, `resume`, `projects` at 390×844 and 1440×900 into `artifacts/screens/<name>/{mobile,desktop}.png`, writes `tour-log.json` (console errors, failed requests, overflow), fails on overflow. `message` is interactive and not a tour command; its captures under `artifacts/screens/cmd-message/` were taken by hand in the merge pass. |
| `make content-check`, `make catalog-check`, `make ledger-check`, `make check-resume-pdf` | the four Python gates above. |
| `make pre-commit` | lint typecheck test test-frontend build content-check ledger-check catalog-check. CI's `test` job runs the same list plus `check_resume_pdf.py`; run `make check-resume-pdf` yourself after a resume change. |

## CI

`.github/workflows/docker-publish.yml`, SHA-pinned actions, `concurrency` cancels superseded runs.

| Job | When | Does |
|---|---|---|
| `test` | push to main, PRs, the Friday rebuild | the `make pre-commit` list (catalog URLs warn-only) plus `check_resume_pdf.py` |
| `tour` | PRs | builds, runs the tour with bundled Chromium, uploads `artifacts/tour/` as the `screenshot-tour` artifact (14 days) |
| `build-frontend`, `build-api` | after `test`; PRs and main | build both images; on PRs load and smoke-test them (healthy, slim, static assets / content endpoints); on main push `latest` and the SHA to ghcr.io |
| `catalog-drift` | Mondays 09:00 UTC, `workflow_dispatch` | `check_catalog.py` with the URL check enforced; a failure emails Mark |
| Friday 08:00 UTC schedule | | `test` then both images rebuilt with `pull` and `no-cache` so base-image fixes land |

Dependabot (`.github/dependabot.yml`) opens weekly PRs for the Docker base images, GitHub Actions and npm.

## Requirements ledger

`docs/requirements/ledger.yaml` has one entry per requirement:

```yaml
- id: SHOW-001            # UPPER-CASE segments: <JOB or NFR-AREA>-<n>
  title: resume command renders resume.json
  job: show               # identify | show | reach | read | maintain
  area: terminal          # page or subsystem
  priority: p0            # p0 must work, p1 should, p2 nice
  visible: true           # optional; done + visible needs a screenshot
  done_means:             # observable criteria naming the content that proves each
    - "`resume` prints the headline, the current role with its highlights, ..."
  status: todo            # todo | in_progress | done | deprecated
  evidence:
    - frontend/tests/commands.test.ts#prints headline, current role with highlights, previous roles, education and skills
    - artifacts/screens/cmd-resume/mobile.png
  notes:
    - "2026-11-05: created from the November review"
```

Evidence forms (`scripts/ledger_check.py`):

- `api/test_app.py::<test_name>` or `scripts/tests/<file>.py::<test_name>` — the file must contain `def <test_name>`
- `frontend/tests/<file>.test.ts#<it title>` — the file must contain the title text
- `artifacts/screens/<name>/<mobile|desktop>.png` — must exist (from `make tour`)
- any other repository path — must exist

`make ledger-check` fails when ids repeat or are malformed, a `job` or `status` is unknown, evidence does not resolve, a `done` entry has no test, a `done` + `visible` entry has no screenshot, or a `deprecated` entry lacks a dated note and evidence that the thing is off. The ledger is updated in the same commit as the work it describes.

## Security rules

- Secrets only in environment variables (`api/.env` locally, the server's `.env` in production). The repo holds no key, token or personal document; `.gitignore` blocks `.env*`.
- The API never returns or logs `OPENWEATHER_API_KEY` or `NTFY_PUBLISH_TOKEN`; `redact_api_key` runs on every logged exception and `api/test_app.py` proves it for both.
- `/weather` is cached so the public, CORS-open endpoint cannot be used to burn the metered key one call per request.
- `POST /contact` validates lengths and the email shape, rate-limits per IP, refuses to run without a token (503, logged) and never stores a message.
- Both containers run as non-root with no curl, npm or shell tooling the runtime does not need; the frontend answers with nosniff, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, a referrer policy and a permissions policy on every route.
- No third-party request on page load: the font is self-hosted and `test_no_third_party_requests_on_page_load` greps the built HTML.
- Command output never becomes HTML: blocks render through interpolation and real anchors (`components.test.ts`, "escapes text instead of injecting HTML").
- GitHub Actions are SHA-pinned; PR builds never log in to the registry; only `main` publishes.
