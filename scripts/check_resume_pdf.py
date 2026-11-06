#!/usr/bin/env python3
"""Fail when content/resume.json is newer than the committed resume PDF.

`make resume-pdf` (scripts/resume_pdf.mjs) writes frontend/public/Mark-Cheli-Resume.pdf
and a sidecar frontend/public/Mark-Cheli-Resume.pdf.json:

  {"generatedFrom": "<meta.lastModified>", "generatedAt": "<ISO>",
   "resumeSha256": "<sha256 of resume.json>"}

This check compares the sidecar's resumeSha256 with the hash of the current resume.json
(and, for older sidecars without a hash, generatedFrom with meta.lastModified).
Exit 1 when the PDF or sidecar is missing or stale; 0 otherwise.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RESUME = REPO_ROOT / "content" / "resume.json"
PDF = REPO_ROOT / "frontend" / "public" / "Mark-Cheli-Resume.pdf"
SIDECAR = PDF.with_name(PDF.name + ".json")


def check(resume: Path = RESUME, pdf: Path = PDF, sidecar: Path = SIDECAR) -> str | None:
    """Return a problem string, or None when the PDF is current."""
    raw = resume.read_bytes()
    last_modified = json.loads(raw)["meta"]["lastModified"]
    current_sha = hashlib.sha256(raw).hexdigest()
    if not pdf.exists():
        return f"{pdf.name} is missing; run `make resume-pdf`"
    if not sidecar.exists():
        return f"{sidecar.name} is missing; run `make resume-pdf`"
    try:
        meta = json.loads(sidecar.read_text(encoding="utf-8"))
        generated_from = meta["generatedFrom"]
        recorded_sha = meta.get("resumeSha256")
        if recorded_sha is not None and recorded_sha != current_sha:
            return (
                "resume PDF was generated from a different resume.json (content hash changed); "
                "run `make resume-pdf` and commit"
            )
        if date.fromisoformat(generated_from) < date.fromisoformat(last_modified):
            return (
                f"resume PDF was generated from resume.json {generated_from} but "
                f"meta.lastModified is {last_modified}; run `make resume-pdf` and commit"
            )
    except (KeyError, ValueError, TypeError) as exc:
        return f"{sidecar.name} is malformed ({exc}); run `make resume-pdf`"
    return None


def main() -> int:
    problem = check()
    if problem:
        print(f"resume-pdf: {problem}", file=sys.stderr)
        return 1
    print("resume-pdf: PDF is current with content/resume.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
