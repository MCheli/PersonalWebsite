"""Tests for scripts/check_resume_pdf.py (sidecar vs resume.json meta.lastModified)."""

import json

import check_resume_pdf as crp


def setup(
    tmp_path, last_modified="2026-11-05", generated_from="2026-11-05", pdf=True, sidecar=True
):
    tmp_path.mkdir(exist_ok=True)
    resume = tmp_path / "resume.json"
    resume.write_text(json.dumps({"meta": {"lastModified": last_modified}}))
    pdf_path = tmp_path / "Mark-Cheli-Resume.pdf"
    if pdf:
        pdf_path.write_bytes(b"%PDF-1.4")
    side = tmp_path / "Mark-Cheli-Resume.pdf.json"
    if sidecar:
        side.write_text(
            json.dumps({"generatedFrom": generated_from, "generatedAt": "2026-11-05T00:00:00Z"})
        )
    return resume, pdf_path, side


def test_current_pdf_passes(tmp_path):
    assert crp.check(*setup(tmp_path)) is None


def test_newer_pdf_passes(tmp_path):
    args = setup(tmp_path, last_modified="2026-11-01", generated_from="2026-11-05")
    assert crp.check(*args) is None


def test_stale_pdf_fails(tmp_path):
    problem = crp.check(*setup(tmp_path, last_modified="2026-11-06", generated_from="2026-11-05"))
    assert problem and "make resume-pdf" in problem


def test_missing_pdf_or_sidecar_fails(tmp_path):
    assert "missing" in crp.check(*setup(tmp_path / "a", pdf=False))
    assert "missing" in crp.check(*setup(tmp_path / "b", sidecar=False))


def test_malformed_sidecar_fails(tmp_path):
    resume, pdf, side = setup(tmp_path)
    side.write_text(json.dumps({"generatedAt": "x"}))
    assert "malformed" in crp.check(resume, pdf, side)
