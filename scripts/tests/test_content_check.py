"""Tests for scripts/content_check.py: the real content passes, and each rule catches
a deliberately broken copy."""

import json
import shutil
from pathlib import Path

import content_check as cc
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTENT = REPO_ROOT / "content"


@pytest.fixture
def content_copy(tmp_path):
    """A writable copy of content/ (schemas stay the real ones)."""
    for name in cc.FILES:
        shutil.copy(CONTENT / name, tmp_path / name)
    return tmp_path


def edit(dir_: Path, name: str, fn) -> None:
    data = json.loads((dir_ / name).read_text())
    fn(data)
    (dir_ / name).write_text(json.dumps(data))


def problems(dir_: Path) -> list[str]:
    return cc.check_all(dir_, cc.SCHEMA_DIR)


def test_real_content_is_valid():
    assert cc.check_all() == []


def test_resume_schema_rejects_bad_dates_and_unknown_top_level_keys(content_copy):
    edit(content_copy, "resume.json", lambda d: d["work"][0].__setitem__("startDate", "Jan 2022"))
    out = problems(content_copy)
    assert any("work/0/startDate" in p for p in out)

    edit(content_copy, "resume.json", lambda d: d.__setitem__("phone", "555"))
    out = problems(content_copy)
    assert any("Additional properties" in p and "phone" in p for p in out)


def test_resume_tolerates_comment_schema_and_meta():
    data = json.loads((CONTENT / "resume.json").read_text())
    assert "$comment" in data and "$schema" in data and "meta" in data
    assert cc.check_all() == []


def test_resume_last_modified_must_be_a_real_date(content_copy):
    edit(content_copy, "resume.json", lambda d: d["meta"].__setitem__("lastModified", "2026-13-40"))
    assert any("meta.lastModified" in p for p in problems(content_copy))


def test_projects_rules(content_copy):
    def dup(d):
        d["projects"].append(dict(d["projects"][0]))

    edit(content_copy, "projects.json", dup)
    assert any("duplicate slug" in p for p in problems(content_copy))

    edit(
        content_copy,
        "projects.json",
        lambda d: d["projects"].__getitem__(0).__setitem__("repo", "https://gitlab.com/x/y"),
    )
    out = problems(content_copy)
    assert any("repo" in p for p in out)

    edit(
        content_copy,
        "projects.json",
        lambda d: d["projects"][1].__setitem__("started", "March 2026"),
    )
    assert any("started" in p for p in problems(content_copy))

    edit(content_copy, "projects.json", lambda d: d["projects"][2].__setitem__("status", "wip"))
    assert any("status" in p for p in problems(content_copy))


def test_services_rules(content_copy):
    def dup(d):
        d["categories"][0]["services"].append(dict(d["categories"][1]["services"][0]))

    edit(content_copy, "services.json", dup)
    assert any("duplicate service name" in p for p in problems(content_copy))

    edit(content_copy, "services.json", lambda d: d["categories"][0]["services"][0].update(bogus=1))
    assert any("bogus" in p for p in problems(content_copy))

    edit(content_copy, "resume.json", lambda d: d["basics"].__setitem__("email", "not-an-email"))
    assert any("email" in p for p in problems(content_copy))


def test_now_rules(content_copy):
    edit(content_copy, "now.json", lambda d: d.__setitem__("items", []))
    assert any("items" in p for p in problems(content_copy))
    edit(content_copy, "now.json", lambda d: d.__setitem__("updated", "yesterday"))
    assert any("updated" in p for p in problems(content_copy))


def test_missing_and_invalid_json(tmp_path):
    (tmp_path / "now.json").write_text("{not json")
    out = problems(tmp_path)
    assert any("now.json: not valid JSON" in p for p in out)
    assert any("resume.json: missing" in p for p in out)
