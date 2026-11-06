# Adding to markcheli.com

How to change the site without breaking its shape. Read `docs/PRODUCT.md` first for what the site is and must not be, and `docs/ARCHITECTURE.md` for the rules this file applies.

## Ground rules

1. Everything about Mark comes from `content/`. A fact typed into a Vue file, `app.py`, a meta tag or a script is a bug.
2. Anything written about Mark follows the voice in `docs/PRODUCT.md`, "Positioning": first-person, some craft, never self-absorbed. Not inflated (no scope verbs, no "executive", no project standing in for the job) and not bland (no "the team handles A, B, C"). Categories, not inventories; the builder comes through. Nothing that reads as job-seeking.
3. A requirement is done only with evidence: a test on the real code path and, for anything visible, a capture from `make tour`. Update `docs/requirements/ledger.yaml` in the same commit.
4. Nothing fake: no invented system facts, no success message for something that did not happen.
5. Commands live in `frontend/commands/registry.ts` and return blocks. No special cases outside the registry, no `v-html`, no padded strings.
6. The 640px breakpoint and the 390px tour are the mobile bar. A change that overflows at 390px fails `make tour`.
7. `make pre-commit` passes before every commit.

## Commands

```bash
make install                                  # api/.venv + frontend/node_modules
NUXT_PUBLIC_API_BASE=http://localhost:5000 make dev   # Flask :5000 + Nuxt :3000 (no dev proxy; the override is required)
make test / make test-frontend                # pytest (api + scripts, test_ssr needs a build) / vitest
make lint / make typecheck                    # ruff + eslint / nuxi typecheck
make build                                    # frontend/.output (the tour, resume-pdf and test_ssr use it)
make tour                                     # artifacts/screens/<name>/{mobile,desktop}.png; TOUR_ARGS="home cmd-about" for a few
make chip-tap                                 # artifacts/screens/chip-tap/{t100,t300,t1200}.png: the services chip tapped at 390px
make og-image / make resume-pdf               # regenerate the committed assets from content/
make check-resume-pdf                         # resume.json vs the PDF sidecar (CI runs it)
make content-check / make catalog-check       # schemas + rules / compose diff + URLs (CATALOG_ARGS="--no-urls" offline)
make ledger-check                             # validate the ledger
make pre-commit                               # the CI test job's list
```

## 1. Change a fact about Mark

Title, summary, a role, a highlight, a skill, an interest, the location, a profile link.

1. Edit `content/resume.json` (JSON Resume v1). Keep the voice rule in front of you: `docs/PRODUCT.md`, "Positioning" (it took five passes with Mark on 2026-11-05; the failure modes are inflation and blandness, and both are described there). Email, city and public profile links only; dates `YYYY-MM` or `YYYY`. Bump `meta.lastModified` and `meta.version` to today.
2. `make content-check`. The schema is the vendored JSON Resume schema plus the repo's date rules.
3. `make test-frontend` and `make test`: the tests read the real content, so a removed key or a renamed network shows up here (`tests/content.test.ts`, `tests/commands.test.ts`, `api/test_app.py::test_resume_endpoint`).
4. `make build && make resume-pdf` and commit `frontend/public/Mark-Cheli-Resume.pdf` and `Mark-Cheli-Resume.pdf.json`. CI runs `scripts/check_resume_pdf.py` and fails when the sidecar's `generatedFrom` is older than `meta.lastModified`.
5. If `basics` changed (name, label, summary, location, image): `make og-image` and commit `frontend/public/og.png`; `services.json` `profile` repeats name, title, company, location and email, so change it too until that duplication goes.
6. If the change is visible on the first screen or in a tour command: `make tour` and commit the captures that changed (`home`, `cmd-about`, `cmd-resume`, `cmd-whoami`, `resume`).

`content/now.json`: edit `items`, set `updated`; `make content-check`; nothing else to regenerate. Never an "open to" line (`tests/registry.test.ts` fails on it).

## 2. Add a terminal command

Only if `docs/PRODUCT.md` lists it in the command table; add it there first.

1. `frontend/commands/<name>.ts` exporting a `Command` (`types/terminal.ts`): `name`, `description` (one line for `help`), `usage` and `longDescription` for `help <name>`, `deepLink: true` if a crawler should reach it at `/?cmd=<name>`, `tour: true` if the tour should capture it, and `run(args, ctx)` returning `OutputBlock[]` built with the constructors in `commands/blocks.ts`. Read content from `ctx.content`; open urls with `ctx.open`; never touch `window`. A question goes through `ctx.prompt(label)` (see `commands/message.ts`).
2. Import it in `frontend/commands/registry.ts` and add it to `commands` at its place in the `help` order.
3. `frontend/commands/registry.json`: add the name to `tour` and/or `deepLink` in registry order. `tests/registry.test.ts` fails until the file matches.
4. `tests/registry.test.ts`: add the name to `EXPECTED` (the help order from `PRODUCT.md`).
5. If `deepLink`: add `<url><loc>https://www.markcheli.com/?cmd=<name></loc>…</url>` to `frontend/public/sitemap.xml` (`tests/seo.test.ts` compares the two).
6. Tests in `frontend/tests/commands.test.ts`: what it prints for a plain call, for each argument shape, and for a bad argument; use `makeContext()` from `tests/helpers.ts`, `blocksText` and `blockHrefs` from `commands/blocks.ts`, and `cloneContent()` when the test changes a content value and expects to see it. An interactive command gets a flow test like `tests/message.test.ts` (answers through `terminal.run`, Ctrl+C, never success without the API's 2xx).
7. If it calls the API: add the call to `utils/api.ts` and `CommandContext`, and the endpoint per section 6.
8. `make tour` (or `make tour TOUR_ARGS="cmd-<name>"`) when `tour: true`; commit `artifacts/screens/cmd-<name>/{mobile,desktop}.png`.
9. Ledger entry under `show` or `reach` with `done_means` naming what it prints, the test titles as evidence, and the captures if `visible: true`.
10. `docs/ARCHITECTURE.md` needs nothing unless the command adds a block kind or a context method.

## 3. Add a project

1. Append to `content/projects.json` `projects`: `slug` (lower-case, unique; it is the anchor on `/projects` and the word `open` accepts), `name`, `tagline`, `description` (what it does and what it is built with; nothing the repo cannot back up), `highlights`, `stack`, `repo` (`https://github.com/MCheli/<repo>`, public with a README), `url` / `demo` when live, `status`, `started` (`YYYY-MM`), `featured`. Set `updated`.
2. `make content-check` (schema, unique slug, repo pattern, dates) and `make catalog-check` (every `url`, `demo` and `repo` must answer).
3. `make test-frontend`: `tests/components.test.ts` asserts every project name is in the SSR block; `tests/commands.test.ts` covers `projects`, `projects all` and `projects <slug>`.
4. `make build && make tour` and commit `artifacts/screens/projects/` and `artifacts/screens/cmd-projects/` (both change).
5. If a project moves on or off the featured list, `docs/PRODUCT.md` D5 lists the agreed set; update it.

## 4. Sync the homelab catalog

When a container is added to or removed from `MCheli/83rr-poweredge`, the Monday `catalog-drift` job fails and emails Mark. To fix it:

1. `make catalog-check` (or `CATALOG_ARGS="--offline ../83rr-poweredge --no-urls"` with a local checkout) prints which containers are missing from the catalog and which catalog entries no longer exist.
2. Edit `content/services.json`. A service's `name` must equal the `container_name`; a service made of several containers lists them in `containers: [...]`; a non-container entry (a repo) uses `containers: []`; a service on other hardware proxied by the R630 sets `external: true`; a container defined in another compose file names it in `compose`. `url` for anything public, `lanOnly: true` for anything that is not, `description` one line, `repo` when the code is public. Set `updated`.
3. `make content-check`, `make catalog-check`, `make test-frontend` (`tests/commands.test.ts` renders every category and counts from the data; `scripts/tests/test_check_catalog.py` runs the diff on fixtures).
4. `make build && make tour`; commit `artifacts/screens/cmd-services/`, `cmd-neofetch/` (container count) and `cmd-contact/` (public services).

The `host` block (OS, kernel, CPU, memory) is typed by hand and not checked; update it when the server changes.

## 5. Add a page

Only when `docs/PRODUCT.md` has a section for it.

1. `frontend/pages/<name>.vue`. Read through `content` from `utils/content.ts`; `useHead(pageHead(content.resume, { path, title, description }))` from `utils/seo.ts`; JSON-LD through `utils/jsonld.ts` if the page is about Mark. Use the CSS variables in `assets/css/terminal.css`; one breakpoint, 640px; a `@media print` block if the page is meant to be printed.
2. Link it from `frontend/layouts/default.vue` and, if a command should point at it, from that command.
3. `frontend/public/sitemap.xml` and `tests/seo.test.ts` (`lists the three pages`, `has no other entries`).
4. `scripts/screenshot_tour.mjs`: add the route to the capture list; `scripts/tests/test_ssr.py`: fetch it from the built server and assert the content it must carry without JavaScript.
5. `make build && make tour`; commit `artifacts/screens/<name>/`. Ledger entry with `visible: true`.

## 6. Add an API endpoint

1. A route in `api/app.py`. Content endpoints return the module-level dicts loaded at import; anything that calls out uses `requests` with a timeout, logs through `redact_api_key`, and returns a JSON error with a status, never a traceback. Add the path to `ENDPOINTS` (the 404 body); `test_404_handler` compares that list to `app.url_map`.
2. Tests in `api/test_app.py`: status, shape, CORS header, the failure paths with `requests` mocked, and that no secret appears in a response or a log line (copy the pattern from the weather and contact tests).
3. If the frontend calls it: `frontend/utils/api.ts` (`createApi`), the method on `CommandContext` in `types/terminal.ts`, `tests/helpers.ts` `makeContext`, and a test in `tests/message.test.ts` or beside it for the `$fetch` adapter.
4. `README.md` endpoint table; a new environment variable goes in `README.md`, `docs/DEPLOYING.md` ("What runs") and the homelab compose file (a PR on `83rr-poweredge`).
5. The PR smoke test in `.github/workflows/docker-publish.yml` curls the content endpoints; add a GET endpoint to that loop.
6. Ledger entry under `read` or `reach`.

## 7. Change the look

1. Colours and spacing are CSS variables in `frontend/assets/css/terminal.css`: the Dracula palette (`--t-bg`, `--t-line`, `--t-fg`, `--t-comment`, `--t-cyan` … `--t-yellow`) and the roles built on it (`--t-heading` purple, `--t-info` pink sub-labels, `--t-key` orange, `--t-link` cyan, `--t-command` yellow, `--t-prompt`/`--t-success` green, `--t-error` red, `--t-muted`, `--t-rule`, `--t-chip-*`, `--t-seg-*` for the prompt segments, `--t-pad`). Change them there, not per component; never put the comment colour on anything a visitor must read. Dark only; JetBrains Mono; green caret. The prompt segments are `components/PromptSegments.vue` (shared by the live prompt and every echoed command).
2. One breakpoint: `640px` (`min-width` for desktop additions, `max-width` for phone-only rules). Nothing may depend on column counts except the figlet, which is hidden below 640px.
3. Printing: `@media print` in `terminal.css`, `pages/resume.vue`, `layouts/default.vue`, `components/CommandBar.vue` and `components/Figlet.vue` produce the black-on-white resume. After a change there, `make resume-pdf` and look at the PDF.
4. `make build && make tour`. Look at every changed capture at both widths; `artifacts/tour/tour-log.json` (or `artifacts/screens/tour-log.json`) must show `overflow: false` everywhere. Commit the captures.
5. If the first screen changed, `IDENT-001`/`IDENT-002`/`SHOW-008`/`NFR-MOB-001` in the ledger point at `home/` captures; add a dated note. If the chip or deep-link behaviour changed, `make chip-tap` (after `make build`) re-captures `artifacts/screens/chip-tap/{t100,t300,t1200}.png` (the `services` chip tapped at 390px: typing visible, then the output at the top) and fails if the typing was not visible or the echoed command did not land at the top; `SHOW-008` points at them.

## 8. Ledger evidence

Evidence strings:

- `api/test_app.py::<test_function>` or `scripts/tests/<file>.py::<test_function>`
- `frontend/tests/<file>.test.ts#<it title>`
- `artifacts/screens/<name>/<mobile|desktop>.png` (or `artifacts/screens/chip-tap/<tick>.png`)
- any other repository path (a committed asset, a script, a document)

`done` needs at least one test. `visible: true` + `done` needs at least one screenshot. `deprecated` needs a dated note and evidence it is off. Every entry gets a dated note when its status changes. The gate is `make ledger-check`; `docs/ARCHITECTURE.md`, "Requirements ledger", has the schema.

## 9. Before you commit

- `make pre-commit` (lint, typecheck, pytest, vitest, build, content-check, ledger-check, catalog-check).
- Changed `resume.json`: `make resume-pdf` (and `make check-resume-pdf`), `make og-image` if basics changed; commit the outputs.
- Visible change: `make tour`; commit the captures.
- Ledger updated in the same commit.
- Nothing about Mark typed outside `content/`; nothing that reads as job-seeking; no secrets, no phone, no street address.
- Commit message says what changed and why; the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) lists the same checks.
