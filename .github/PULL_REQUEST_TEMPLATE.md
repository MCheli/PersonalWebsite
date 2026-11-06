## What

<!-- One or two sentences. Link the ledger ids this touches (e.g. SHOW-002, MAINT-001). -->

## Checklist

- [ ] `docs/PRODUCT.md` consulted; this change is in scope (or PRODUCT.md is updated in this PR)
- [ ] `docs/requirements/ledger.yaml` updated: status, evidence (test and, for visible changes, tour capture), dated note
- [ ] `make pre-commit` passed locally (lint, typecheck, tests, build, content-check, ledger-check, catalog-check)
- [ ] Visible change: tour captures under `artifacts/screens/` regenerated with `make tour` and committed
- [ ] Content change to `resume.json`: `make resume-pdf` run and the PDF + sidecar committed; `make og-image` if basics changed
