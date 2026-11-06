#!/usr/bin/env python3
"""Catalog drift check: content/services.json against the homelab compose files.

Two questions, answered by a machine instead of by Mark remembering:

1. Is the catalog still the current stack? Downloads docker-compose.yml (and every
   per-entry `compose` override, e.g. infrastructure/openclaw/docker-compose.yml)
   from MCheli/83rr-poweredge main, collects `container_name` values and diffs them
   against the catalog:
     - a service's `name` must be a container, unless it lists its real containers in
       `containers: [...]` (empty list = not a container, e.g. a repo entry), or it is
       `external: true` (runs elsewhere, proxied by the R630);
     - every compose container must appear in the catalog.
2. Do the public URLs still answer? HEAD then GET on every https url in
   services.json and projects.json (url, demo, repo), skipping `lanOnly: true`
   entries and categories and non-http values. 2xx/3xx/401/403 count as alive
   (Cloudflare Access and SSO front some of them); anything else, or a connection
   error, is dead.

Usage:
  python scripts/check_catalog.py                       # live: GitHub + URLs
  python scripts/check_catalog.py --no-urls             # compose diff only
  python scripts/check_catalog.py --urls-warn-only      # URL failures warn, do not fail (PR CI)
  python scripts/check_catalog.py --offline <path>      # compose from a local checkout
      <path> is the root of a local 83rr-poweredge checkout (per-entry `compose`
      paths resolve under it) or a single compose file (overrides resolve beside it).

Exit code 0 when everything matches, 1 on drift or dead URLs, 2 when the compose
file cannot be fetched or parsed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("catalog: PyYAML is required (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = REPO_ROOT / "content"
RAW_BASE = "https://raw.githubusercontent.com/MCheli/83rr-poweredge/main/"
MAIN_COMPOSE = "docker-compose.yml"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36 markcheli-catalog-check/1.0"
)
ALIVE_STATUSES = {401, 403}
TIMEOUT = 10
CONTAINER_NAME_RE = re.compile(r"^\s*container_name:\s*['\"]?([A-Za-z0-9][A-Za-z0-9_.-]*)")


# --- compose ---------------------------------------------------------------------


def container_names(compose_text: str) -> set[str]:
    """`container_name` values in a compose file.

    pyyaml resolves anchors (`*postgres16-image`); a regex fallback covers a file
    that pyyaml refuses (unusual tags) so the check degrades instead of crashing.
    """
    try:
        doc = yaml.safe_load(compose_text)
    except yaml.YAMLError:
        doc = None
    names: set[str] = set()
    if isinstance(doc, dict) and isinstance(doc.get("services"), dict):
        for svc in doc["services"].values():
            if isinstance(svc, dict) and isinstance(svc.get("container_name"), str):
                names.add(svc["container_name"])
        return names
    for line in compose_text.splitlines():
        m = CONTAINER_NAME_RE.match(line)
        if m:
            names.add(m.group(1))
    return names


def compose_paths(catalog: dict) -> list[str]:
    """The main compose file plus every per-entry `compose` override, in order."""
    paths = [MAIN_COMPOSE]
    for cat in catalog.get("categories", []):
        for svc in cat.get("services", []):
            override = svc.get("compose")
            if isinstance(override, str) and override and override not in paths:
                paths.append(override)
    return paths


def fetch_compose_text(path: str, offline: Path | None) -> str:
    if offline is not None:
        base = offline if offline.is_dir() else offline.parent
        local = offline if (offline.is_file() and path == MAIN_COMPOSE) else base / path
        return local.read_text(encoding="utf-8")
    import requests

    resp = requests.get(RAW_BASE + path, timeout=TIMEOUT, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text


# --- catalog diff ------------------------------------------------------------------


@dataclass
class Diff:
    missing_from_catalog: list[str] = field(default_factory=list)  # in compose, not catalog
    missing_from_compose: list[str] = field(default_factory=list)  # in catalog, not compose

    @property
    def ok(self) -> bool:
        return not self.missing_from_catalog and not self.missing_from_compose


def expected_containers(svc: dict) -> list[str]:
    """Containers an entry claims. [] for external / non-container entries."""
    if svc.get("external"):
        return []
    if "containers" in svc:
        return list(svc["containers"] or [])
    return [svc["name"]]


def diff_catalog(catalog: dict, compose_names: set[str]) -> Diff:
    diff = Diff()
    claimed: set[str] = set()
    for cat in catalog.get("categories", []):
        for svc in cat.get("services", []):
            for name in expected_containers(svc):
                claimed.add(name)
                if name not in compose_names:
                    diff.missing_from_compose.append(f"{svc['name']} -> {name}")
    diff.missing_from_catalog = sorted(compose_names - claimed)
    diff.missing_from_compose.sort()
    return diff


# --- urls --------------------------------------------------------------------------


def public_urls(catalog: dict, projects: dict) -> list[tuple[str, str]]:
    """(label, url) pairs worth checking: https only, LAN-only entries skipped."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(label: str, value: object) -> None:
        if isinstance(value, str) and value.startswith("https://") and value not in seen:
            seen.add(value)
            out.append((label, value))

    profile = catalog.get("profile", {})
    for key in ("website", "linkedin", "github"):
        add(f"profile.{key}", profile.get(key))
    add("host.repo", catalog.get("host", {}).get("repo"))
    for cat in catalog.get("categories", []):
        cat_lan = bool(cat.get("lanOnly"))
        for svc in cat.get("services", []):
            if not (cat_lan or svc.get("lanOnly")):
                add(f"services:{svc['name']}.url", svc.get("url"))
            add(f"services:{svc['name']}.repo", svc.get("repo"))
    for proj in projects.get("projects", []):
        for key in ("url", "demo", "repo"):
            add(f"projects:{proj['slug']}.{key}", proj.get(key))
    return out


def check_url(url: str) -> tuple[bool, str]:
    """HEAD then GET; returns (alive, detail)."""
    import requests

    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    last = ""
    for method in ("head", "get"):
        try:
            resp = requests.request(
                method.upper(), url, headers=headers, timeout=TIMEOUT, allow_redirects=True
            )
        except requests.RequestException as exc:
            last = f"{method.upper()} {type(exc).__name__}"
            continue
        if resp.status_code < 400 or resp.status_code in ALIVE_STATUSES:
            return True, f"{method.upper()} {resp.status_code}"
        last = f"{method.upper()} {resp.status_code}"
    return False, last


# --- main --------------------------------------------------------------------------


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--no-urls", action="store_true", help="skip the URL liveness check")
    ap.add_argument(
        "--urls-warn-only", action="store_true", help="report dead URLs but exit 0 for them"
    )
    ap.add_argument(
        "--offline",
        type=Path,
        metavar="PATH",
        help="read compose files from a local 83rr-poweredge checkout (dir) or a compose file",
    )
    ap.add_argument("--catalog", type=Path, default=CONTENT_DIR / "services.json")
    ap.add_argument("--projects", type=Path, default=CONTENT_DIR / "projects.json")
    args = ap.parse_args(argv)

    catalog = load_json(args.catalog)
    projects = load_json(args.projects) if args.projects.exists() else {"projects": []}

    names: set[str] = set()
    for path in compose_paths(catalog):
        try:
            text = fetch_compose_text(path, args.offline)
        except Exception as exc:  # network, 404, missing local file
            print(f"catalog: cannot read {path}: {type(exc).__name__}: {exc}", file=sys.stderr)
            return 2
        found = container_names(text)
        if not found:
            print(f"catalog: no container_name values found in {path}", file=sys.stderr)
            return 2
        print(f"catalog: {path}: {len(found)} containers")
        names |= found

    diff = diff_catalog(catalog, names)
    failed = False
    if diff.missing_from_catalog:
        failed = True
        print("catalog: containers in compose but not in content/services.json:", file=sys.stderr)
        for n in diff.missing_from_catalog:
            print(f"  x {n}", file=sys.stderr)
    if diff.missing_from_compose:
        failed = True
        print("catalog: catalog entries whose container is not in compose:", file=sys.stderr)
        for n in diff.missing_from_compose:
            print(f"  x {n}", file=sys.stderr)
    if diff.ok:
        print(f"catalog: {len(names)} containers all accounted for")

    if not args.no_urls:
        dead: list[str] = []
        urls = public_urls(catalog, projects)
        for label, url in urls:
            alive, detail = check_url(url)
            mark = "ok" if alive else "DEAD"
            print(f"  {mark:4} {detail:24} {url}  ({label})")
            if not alive:
                dead.append(f"{url} ({label}): {detail}")
        if dead:
            level = "warning" if args.urls_warn_only else "error"
            print(f"catalog: {len(dead)} dead url(s) [{level}]:", file=sys.stderr)
            for d in dead:
                print(f"  x {d}", file=sys.stderr)
            if not args.urls_warn_only:
                failed = True
        else:
            print(f"catalog: {len(urls)} public urls alive")

    print("catalog: FAILED" if failed else "catalog: OK", file=sys.stderr if failed else sys.stdout)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
