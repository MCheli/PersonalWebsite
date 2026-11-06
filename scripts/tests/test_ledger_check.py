"""Unit tests for scripts/ledger_check.py and a run against the real ledger."""

from pathlib import Path

import ledger_check as lc

REPO_ROOT = Path(__file__).resolve().parents[2]


def write(tmp_path: Path, text: str) -> Path:
    f = tmp_path / "ledger.yaml"
    f.write_text(text, encoding="utf-8")
    return f


def entry(**over) -> str:
    base = {
        "id": "SHOW-001",
        "title": "A thing",
        "job": "show",
        "area": "terminal",
        "priority": "p0",
        "status": "todo",
    }
    base.update(over)
    lines = ["requirements:", "  - id: " + base["id"]]
    for k in ("title", "job", "area", "priority", "status"):
        lines.append(f"    {k}: {base[k]}")
    if "visible" in base:
        lines.append(f"    visible: {str(base['visible']).lower()}")
    lines.append('    done_means: ["it works"]')
    ev = base.get("evidence", [])
    lines.append("    evidence: [" + ", ".join(f'"{e}"' for e in ev) + "]")
    notes = base.get("notes", [])
    lines.append("    notes: [" + ", ".join(f'"{n}"' for n in notes) + "]")
    return "\n".join(lines) + "\n"


def test_missing_file_is_not_found(tmp_path):
    report = lc.validate_ledger(tmp_path / "nope.yaml", tmp_path)
    assert not report.found and report.ok


def test_todo_entry_validates(tmp_path):
    report = lc.validate_ledger(write(tmp_path, entry()), tmp_path)
    assert report.ok and report.counts["todo"] == 1


def test_unknown_job_and_bad_id_are_problems(tmp_path):
    report = lc.validate_ledger(write(tmp_path, entry(id="show1", job="look")), tmp_path)
    assert any("id:" in p for p in report.problems)
    assert any("job:" in p for p in report.problems)


def test_duplicate_ids(tmp_path):
    text = entry() + entry().replace("requirements:\n", "")
    report = lc.validate_ledger(write(tmp_path, text), tmp_path)
    assert any("duplicate id" in p for p in report.problems)


def test_done_needs_a_test_that_exists(tmp_path):
    (tmp_path / "api").mkdir()
    (tmp_path / "api" / "test_app.py").write_text("def test_resume_endpoint():\n    pass\n")
    ok = entry(status="done", evidence=["api/test_app.py::test_resume_endpoint"])
    assert lc.validate_ledger(write(tmp_path, ok), tmp_path).ok

    wrong_name = entry(status="done", evidence=["api/test_app.py::test_nope"])
    report = lc.validate_ledger(write(tmp_path, wrong_name), tmp_path)
    assert any('test "test_nope" not found' in p for p in report.problems)

    only_path = entry(status="done", evidence=["api/test_app.py"])
    report = lc.validate_ledger(write(tmp_path, only_path), tmp_path)
    assert any("at least one automated test" in p for p in report.problems)

    no_evidence = entry(status="done")
    report = lc.validate_ledger(write(tmp_path, no_evidence), tmp_path)
    assert any("no evidence" in p for p in report.problems)


def test_vitest_title_evidence(tmp_path):
    (tmp_path / "frontend" / "tests").mkdir(parents=True)
    (tmp_path / "frontend" / "tests" / "commands.test.ts").write_text(
        "it('resume prints the headline', () => {})\n"
    )
    ok = entry(
        status="done", evidence=["frontend/tests/commands.test.ts#resume prints the headline"]
    )
    assert lc.validate_ledger(write(tmp_path, ok), tmp_path).ok
    bad = entry(status="done", evidence=["frontend/tests/commands.test.ts#something else"])
    assert not lc.validate_ledger(write(tmp_path, bad), tmp_path).ok


def test_visible_done_needs_screenshot(tmp_path):
    (tmp_path / "api").mkdir()
    (tmp_path / "api" / "test_app.py").write_text("def test_a():\n    pass\n")
    text = entry(status="done", visible=True, evidence=["api/test_app.py::test_a"])
    report = lc.validate_ledger(write(tmp_path, text), tmp_path)
    assert any("screenshot" in p for p in report.problems)

    shots = tmp_path / "artifacts" / "screens" / "resume"
    shots.mkdir(parents=True)
    (shots / "mobile.png").write_bytes(b"\x89PNG")
    text = entry(
        status="done",
        visible=True,
        evidence=["api/test_app.py::test_a", "artifacts/screens/resume/mobile.png"],
    )
    assert lc.validate_ledger(write(tmp_path, text), tmp_path).ok


def test_evidence_outside_repo_is_rejected(tmp_path):
    text = entry(status="done", evidence=["../../etc/passwd::test_x"])
    report = lc.validate_ledger(write(tmp_path, text), tmp_path)
    assert any("outside the repository" in p for p in report.problems)


def test_deprecated_needs_note_and_evidence(tmp_path):
    report = lc.validate_ledger(write(tmp_path, entry(status="deprecated")), tmp_path)
    assert any("dated note" in p for p in report.problems)
    assert any("evidence that it is off" in p for p in report.problems)


def test_real_ledger_validates():
    ledger = REPO_ROOT / "docs" / "requirements" / "ledger.yaml"
    report = lc.validate_ledger(ledger, REPO_ROOT)
    assert report.found
    assert report.ok, report.problems
