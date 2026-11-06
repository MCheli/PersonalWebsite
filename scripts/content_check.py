#!/usr/bin/env python3
"""Validate content/*.json against content/schemas/*.schema.json plus cross-field rules.

  python scripts/content_check.py            # exit 1 listing every problem

Files and schemas:
  services.json -> services.schema.json   (draft-07, written here)
  projects.json -> projects.schema.json   (draft-07, written here)
  now.json      -> now.schema.json        (draft-07, written here)
  resume.json   -> resume.schema.json     (JSON Resume v1.0.0, vendored; draft-04)

The resume schema has additionalProperties: false at the top level and does not
list `$comment`, so that key is dropped before validation (it is documentation).
`$schema` and `meta` are part of the official schema and validate as-is.

Extra rules the schemas cannot express:
  - project slugs are unique; service names are unique across categories
  - every project `repo` is https://github.com/MCheli/<repo>
  - dates: `updated` is YYYY-MM-DD; `started`, work/education/certificate dates are
    YYYY or YYYY-MM (YYYY-MM-DD also accepted, per JSON Resume)
  - resume meta.lastModified is a real calendar date; basics.email looks like an email
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    from jsonschema import Draft4Validator, Draft7Validator
except ImportError:  # pragma: no cover
    print("content: jsonschema is required (pip install jsonschema)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = REPO_ROOT / "content"
SCHEMA_DIR = CONTENT_DIR / "schemas"

FILES = {
    "services.json": ("services.schema.json", Draft7Validator),
    "projects.json": ("projects.schema.json", Draft7Validator),
    "now.json": ("now.schema.json", Draft7Validator),
    "resume.json": ("resume.schema.json", Draft4Validator),
}

FULL_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PARTIAL_DATE_RE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
GITHUB_REPO_RE = re.compile(r"^https://github\.com/MCheli/[A-Za-z0-9_.-]+$")


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def is_real_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except (TypeError, ValueError):
        return False
    return True


def schema_problems(name: str, data: dict, schema: dict, validator_cls) -> list[str]:
    validator_cls.check_schema(schema)
    out = []
    for err in sorted(validator_cls(schema).iter_errors(data), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(p) for p in err.absolute_path) or "<root>"
        out.append(f"{name}: {where}: {err.message}")
    return out


def check_partial_dates(name: str, where: str, obj: dict, keys: tuple[str, ...]) -> list[str]:
    out = []
    for key in keys:
        if key in obj and obj[key] is not None:
            value = obj[key]
            if not isinstance(value, str) or not PARTIAL_DATE_RE.match(value):
                out.append(f"{name}: {where}.{key}: {value!r} is not YYYY or YYYY-MM")
    return out


def rule_problems(contents: dict[str, dict]) -> list[str]:
    out: list[str] = []

    for name, data in contents.items():
        if "updated" in data and not (
            isinstance(data["updated"], str)
            and FULL_DATE_RE.match(data["updated"])
            and is_real_date(data["updated"])
        ):
            out.append(f"{name}: updated: {data.get('updated')!r} is not a YYYY-MM-DD date")

    projects = contents.get("projects.json", {}).get("projects", [])
    slugs = [p.get("slug") for p in projects]
    for slug in sorted({s for s in slugs if slugs.count(s) > 1}):
        out.append(f"projects.json: duplicate slug {slug!r}")
    for p in projects:
        label = f"projects[{p.get('slug')}]"
        if not GITHUB_REPO_RE.match(str(p.get("repo", ""))):
            out.append(f"projects.json: {label}.repo must be https://github.com/MCheli/<repo>")
        out += check_partial_dates("projects.json", label, p, ("started",))

    catalog = contents.get("services.json", {})
    names = [s.get("name") for c in catalog.get("categories", []) for s in c.get("services", [])]
    for n in sorted({n for n in names if names.count(n) > 1}):
        out.append(f"services.json: duplicate service name {n!r}")
    for c in catalog.get("categories", []):
        for s in c.get("services", []):
            if s.get("external") and s.get("containers"):
                out.append(
                    f"services.json: {s.get('name')}: external entries cannot list containers"
                )

    resume = contents.get("resume.json", {})
    email = resume.get("basics", {}).get("email", "")
    if not isinstance(email, str) or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        out.append("resume.json: basics.email must be a plausible email address")
    for i, w in enumerate(resume.get("work", [])):
        out += check_partial_dates("resume.json", f"work[{i}]", w, ("startDate", "endDate"))
    for i, e in enumerate(resume.get("education", [])):
        out += check_partial_dates("resume.json", f"education[{i}]", e, ("startDate", "endDate"))
    for i, cert in enumerate(resume.get("certificates", [])):
        out += check_partial_dates("resume.json", f"certificates[{i}]", cert, ("date",))
    meta = resume.get("meta", {})
    last = meta.get("lastModified")
    if not (isinstance(last, str) and FULL_DATE_RE.match(last) and is_real_date(last)):
        out.append(f"resume.json: meta.lastModified: {last!r} is not a YYYY-MM-DD date")
    return out


def check_all(content_dir: Path = CONTENT_DIR, schema_dir: Path = SCHEMA_DIR) -> list[str]:
    problems: list[str] = []
    contents: dict[str, dict] = {}
    for name, (schema_name, validator_cls) in FILES.items():
        path = content_dir / name
        if not path.exists():
            problems.append(f"{name}: missing")
            continue
        try:
            data = load(path)
        except json.JSONDecodeError as exc:
            problems.append(f"{name}: not valid JSON: {exc}")
            continue
        contents[name] = data
        schema = load(schema_dir / schema_name)
        candidate = dict(data)
        if name == "resume.json":
            candidate.pop("$comment", None)
        problems += schema_problems(name, candidate, schema, validator_cls)
    problems += rule_problems(contents)
    return problems


def main() -> int:
    problems = check_all()
    for p in problems:
        print(f"  x {p}", file=sys.stderr)
    if problems:
        print(f"content: {len(problems)} problem(s)", file=sys.stderr)
        return 1
    print(f"content: {', '.join(FILES)} valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
