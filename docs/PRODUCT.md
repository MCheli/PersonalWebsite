# markcheli.com — what it is

Source of truth for scope. If the code and this file disagree, this file wins until it is changed. Requirements with status and evidence are in `docs/requirements/ledger.yaml`; how the code is laid out is in `docs/ARCHITECTURE.md`.

## Purpose

markcheli.com is Mark Cheli's personal site. It has one job: **when someone who could work with, build with, or one day hire Mark lands here, they leave knowing who he is, what he has built, and how to reach him — in under a minute, on a phone.** It must do that job without ever reading as a job search: Mark is not looking, and the people he works with read it too. The terminal is the personality of the site, not its purpose. Nothing the site needs to say may be reachable only by typing.

Audiences, in priority order:

1. **A hiring manager or recruiter** who got the link from a resume, LinkedIn or a referral. On a phone, between meetings. Needs: title and summary, resume, projects, contact. Will not type commands.
2. **An engineer or PM** vetting Mark before an interview or a collaboration. Needs: projects with real code behind them, how he works, the homelab.
3. **Search engines and AI assistants** answering "who is Mark Cheli". Need: everything above as server-rendered HTML and JSON, with structured data.
4. **Mark**, checking that the site still tells the truth. Needs: one place to edit each fact, and a check that catches drift.

Non-goals: a blog (there is nothing to publish yet), analytics, comments, a contact form (email and LinkedIn are enough), anything that needs a database.

## Positioning

Mark is the director of Onshape's Product Operations & Strategy team at PTC: a small team that handles the product org's planning and review cycle, product analytics, the rollout of AI tools across R&D, localization, and a few internal tools. He came up through engineering (thirteen years at PTC from intern to director) and still writes code when it's the fastest route. Outside work: a homelab and the small apps on it.

**Voice.** First-person, with some craft, never self-absorbed. Two failure modes Mark has rejected (2026-11-05): inflation ("I steer how the R&D org plans, measures and builds"; scope verbs like own/drive/lead-the-transformation; "executive") and blandness ("I'm the director of X. The team handles A, B, C and a few D"). Describe the job by what it is for, not by enumerating its parts: any list of responsibilities is both too specific and incomplete, and one named project makes the job look small. Categories are fine ("the programs that cut across every team"); inventories are not. The builder has to come through — software, and physical things too (welding, 3D printing, old trucks, CAD) — because that is who he is and because the physical-product world is part of where he belongs. The test: a coworker reads it and thinks "yes, that's him", not "he thinks he runs the company" and not "a bot wrote this".

## Content model: three JSON files and a small fourth

Every fact on the site comes from `content/`. Nothing about Mark is hard-coded in a Vue file, a Python file or a meta tag.

| File | Holds | Rendered by |
|---|---|---|
| `content/resume.json` | [JSON Resume](https://jsonresume.org/schema) v1: basics, work, education, skills, certificates, interests | `resume` command · `/resume` page · `public/Mark-Cheli-Resume.pdf` · API `/resume` · JSON-LD Person · `<title>`/description |
| `content/projects.json` | Portfolio projects: slug, name, tagline, description, highlights, stack, repo, url, demo, status, started, featured | `projects` command · `/projects` page · API `/projects` · SSR content |
| `content/services.json` | Homelab catalog: host, profile links, categories of services with container names | `services` command (alias `homelab`) · `neofetch` · `contact` · API `/services`, `/profile` · SSR content |
| `content/now.json` | What Mark is doing now | `now` command · SSR content |

Rules:

- `services.json` service `name` must equal the `container_name` in [MCheli/83rr-poweredge](https://github.com/MCheli/83rr-poweredge) `docker-compose.yml`, or the entry lists its real containers in `containers: []` (empty when the entry is not a container, such as a repo), or it is `external: true` (runs elsewhere, proxied by the R630). `scripts/check_catalog.py` diffs the catalog against the live compose file on GitHub and fails CI weekly when they drift. This is how the "is it still the current stack?" question gets answered by a machine instead of by Mark remembering.
- Every public `url` in `services.json` and `projects.json` must respond; the same script checks them.
- The resume carries email, city and public profile links only. No phone, no street address, no compensation, nothing from the private parts of Mark's life.
- Project descriptions state what the thing does and what it is built with. No "passionate", no "leveraged", no claims the repo can't back up.
- Dates are `YYYY-MM` where known, `YYYY` otherwise. The JSON files carry an `updated` date; the site shows it on the resume page so a reader can tell how fresh it is.

## The site

### `/` — the terminal

Dark, monospace, the "MARK CHELI" figlet on desktop. The palette is Dracula, the theme Mark's own Terminal.app runs, used with intent: purple headings, pink sub-labels, orange keys, cyan underlined links, yellow for the command that was typed, green for the prompt and for success, red for errors, the comment colour for anything secondary. The prompt is the Powerlevel10k rainbow his shell draws: `mark` · `~/83rr-poweredge` (`~` on a phone) · `master` as powerline segments (CSS, no icon font), then `❯` and the input on the next line; echoed commands use the same prompt so the transcript reads like one session. What a visitor sees without typing anything, in order:

1. **Identity line** (plain text, server-rendered, visible, not just for crawlers): "Mark Cheli — Director, Product Operations & Strategy at Onshape (PTC). Ashland, MA." and the one-sentence summary from `resume.json`.
2. **The figlet and the host block** on wide screens. On narrow screens the figlet is replaced by the name in large text, because an 80-column figlet does not fit a 390-pixel phone (today it wraps into noise).
3. **A command bar**: tappable chips for `about` `projects` `resume` `services` `contact` `help`. Tapping one brings the prompt into view, types the command into it character by character (about 30 ms a character, instant under `prefers-reduced-motion`), pauses, runs it exactly as Enter would, and scrolls the echoed command line to the top of the screen so the output is what the visitor sees next. The chips are disabled while that happens; on a touch screen the keyboard stays down. On desktop the chips are the hint under the prompt; on mobile they are a sticky row above the keyboard. This is how the site works for the 60% of visitors who are on a phone and will not type.
4. The prompt.

Commands. Each is a typed entry in one registry (`commands/`), which is the only source for `help`, tab completion and `help <cmd>`. There are no special-cased commands outside the registry.

| Command | Does |
|---|---|
| `help`, `?` | Lists commands with one-line descriptions; `help <cmd>` gives the long description and usage |
| `about` | Three short paragraphs from `resume.json` basics + summary, and where to go next |
| `resume` | Headline, current role with highlights, previous roles as one line each, education, skills by group; ends with links to `/resume` (readable) and the PDF |
| `projects` | Featured projects first: name, tagline, stack, repo/url; `projects <slug>` prints one project in full; `projects all` lists everything |
| `services` (alias `homelab`) | The catalog: a header line with the host name, service and container counts and the hardware; each category as a heading with a rule; one row per service (the name is a link when it has a url, the description beside it, repo and notes on a second line); a summary of counts per category; "Type a service name … to open it." Two columns on wide screens, stacked on a phone; counts come from the data |
| `now` | `content/now.json` |
| `contact` | Email (as a `mailto:` link), LinkedIn, GitHub, and the public services; ends with "or type `message` to send a note from here" |
| `message` | Interactive: asks for name, email and the message one prompt at a time (Ctrl+C cancels), then `POST /api/contact`. Success prints "Sent — I'll reply to <email>."; failure prints the reason. Never claims success unless the API returned 2xx |
| `open <name>` | Opens a project url, a service url or a shortcut (`linkedin`, `github`, `resume-pdf`) in a new tab. Typing a bare project or service name also opens it, as today |
| `neofetch` | The figlet + host block, from `services.json` |
| `whoami` | One line: name, title, location — from `resume.json` |
| `weather` | Weather in Ashland from the API; failure prints a one-line error |
| `clear` (and Ctrl+L) | Clears |
| `history` | Commands typed this session |
| `ls` | Lists the "directories" `about/ projects/ resume/ services/ contact/` as a nudge, not a fake Unix listing |
| `exit` | Prints a goodbye and the links; does not close anything |

Behaviour:

- Empty Enter does nothing (today it opens LinkedIn in a new tab, which is surprising and gets popup-blocked).
- Unknown command: "command not found: X" plus the closest match ("did you mean `projects`?") when one is within edit distance 2.
- Output is **structured, not pre-formatted text**: a command returns blocks (`text`, `heading`, `list`, `kv` rows, `table` rows, `link`, `figlet`) and the renderer lays them out, wrapping on narrow screens instead of relying on column padding. URLs are real `<a>` elements, never regex-linkified HTML strings.
- `?cmd=<command>` on `/` still auto-types and runs the command (crawlers and the sitemap use it), through the same code path as a chip tap. A `?cmd=` value that is not a known command is ignored.
- Up/Down history, Tab completion, Ctrl+C clears input, Ctrl+L clears screen, as today.
- Clicking the page focuses the input unless text is selected. The listener is removed on unmount.
- The input is 16px or larger so iOS does not zoom on focus; `autocapitalize`, `autocorrect` and `spellcheck` are off; `enterkeyhint="go"`.
- Everything the commands can print is also in the server-rendered HTML below the fold (visually hidden, as today) so crawlers get the resume, projects and catalog without JavaScript.

### `/resume` — readable resume

The same `resume.json`, as a page a person reads: name, title, summary, work (newest first; role, company, dates, summary, highlights), education, certificates, skills, interests, links. Dark theme matching the terminal; a print stylesheet that produces a clean black-on-white, two-page document; a "Download PDF" link to `/Mark-Cheli-Resume.pdf`. The `updated` date in the footer.

The PDF is generated from this page by `make resume-pdf` (Playwright, print media) and committed. CI fails if `resume.json` is newer than the PDF.

### `/projects` — readable projects

`projects.json` as cards: name, tagline, description, highlights, stack chips, links to repo / live / demo, status and start date. Featured first. Each card has an anchor (`/projects#tallied`) so a project can be linked from a cover letter.

### Crawlers and assistants

- `robots.txt` allows everything; the sitemap lists `/`, `/resume`, `/projects` and the `?cmd=` entries.
- JSON-LD on `/`: `Person` (name, jobTitle, worksFor, address locality, sameAs, url) and `WebSite`. On `/resume`: the `Person` again. Built from `resume.json`, not typed by hand.
- `<title>` and descriptions come from `resume.json` basics. OG/Twitter image is a real 1200×630 PNG at `/og.png` (generated by `make og-image`, committed), not the favicon.
- The API (`flask.markcheli.com`, and the same thing at `www.markcheli.com/api/` via the homelab nginx) serves `/resume`, `/projects`, `/services`, `/profile`, `/now` as JSON with permissive CORS, so an assistant that prefers JSON over HTML can take it. The frontend calls the relative `/api` by default (`NUXT_PUBLIC_API_BASE` overrides it for local dev).
- `POST /contact` (JSON: name, email, message, and a honeypot field `website` that must be empty) publishes the note to Mark's phone through the homelab's ntfy (`NTFY_URL`, `NTFY_TOPIC`, `NTFY_PUBLISH_TOKEN`). Validation: name 1–100 chars, a plausible email, message 10–2000 chars; per-IP limit of 3 per hour (from `X-Real-IP`/`X-Forwarded-For` behind nginx); 503 when no token is configured, never a silent drop. Nothing is stored.

### Not changing

- The dark terminal aesthetic (Dracula since 2026-11-06), JetBrains Mono, the green prompt caret, the figlet.
- Two containers (Nuxt SSR + Flask) deployed by GitHub Actions → ghcr.io → Watchtower. The Flask API is small; it stays because it is part of the catalog story and costs nothing.
- `?cmd=` deep links.

## Quality bar

- **Mobile first.** Every screen in the tour at 390px must be readable without horizontal scrolling, and every command reachable without a keyboard. This is the bar the old site failed.
- **Nothing fake.** No "Last login from local-machine", no "Status: Operational" that nothing measures, no fake `ls` listing, no success message for something that didn't happen.
- **One fact, one place.** If the same fact appears in two files, one of them is wrong eventually. Everything derives from `content/`.
- **Evidence.** A requirement is done when the ledger points at a test and, for anything visible, a screenshot from `make tour`.
- **Gates.** `make pre-commit` = lint + typecheck + tests (api and frontend) + build + ledger-check + catalog-check. CI runs the same, plus the Docker build and smoke test, plus the tour as a downloadable artifact on every PR.

## Decisions awaiting Mark

- **D1 — resolved 2026-11-05.** Mark is not job hunting and his manager may read the site. Nothing on the site may suggest he is open to roles, available, or looking — no "open to" line, no "hire me" wording. The job the site does is the same either way: say who he is, show the work, make him easy to reach.
- **D2 — resolved 2026-11-05.** Mark: experiment with a photo (his GitHub/LinkedIn avatar) but it probably won't suit the terminal theme. Wired so that `basics.image` in `resume.json` pointing at `frontend/public/headshot.jpg` shows on /resume and in the OG image; shipped without one unless the experiment looks right.
- **D3 — resolved 2026-11-05 (five passes).** Inflation, then blandness, then a voice, then over-claiming again, then the fifth: the third's voice with the facts straight (the team helps decide rather than decides; AI scoped to the Onshape organization; "world's fastest-growing CAD platform" is the market's phrase and Mark's choice). See "Voice" under Positioning. He will keep iterating on `content/resume.json` directly.
- **D4 — resolved 2026-11-05.** Mark approved changes to `83rr-poweredge`: route `www.markcheli.com/api/*` → `flask-api` so the site can call a relative URL, and add whatever else the site needs there (a contact endpoint that pushes to ntfy, for one). Tracked in the homelab repo's PR.
- **D5 — resolved 2026-11-05.** The eleven listed projects and the four featured ones (Tallied, RigReady, homelab, Tasks) are right. Seven, os-releases, transfer, tycootdw and HeyClawy stay off until they are public with a README.
