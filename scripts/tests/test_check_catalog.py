"""Unit tests for scripts/check_catalog.py: the compose diff on fixture text and the
URL filter, plus the real catalog against a local compose checkout when present."""

import json
from pathlib import Path

import check_catalog as cc
import pytest

FIXTURE_COMPOSE = """
x-postgres16: &postgres16-image postgres:16.10-alpine3.22

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: nginx
  tallied:
    image: ghcr.io/mcheli/tallied:latest
    container_name: tallied
  tallied-db:
    image: *postgres16-image
    container_name: "tallied-db"
  deptrack-apiserver:
    image: dependencytrack/apiserver
    container_name: deptrack-apiserver
  deptrack-frontend:
    image: dependencytrack/frontend
    container_name: deptrack-frontend
  no-name:
    image: busybox
"""

FIXTURE_OPENCLAW = """
services:
  openclaw:
    image: openclaw:latest
    container_name: openclaw
"""


def catalog(*services, categories=None):
    return {
        "host": {"repo": "https://github.com/MCheli/83rr-poweredge"},
        "categories": categories or [{"id": "all", "title": "All", "services": list(services)}],
    }


def test_container_names_resolves_anchors_and_quotes():
    assert cc.container_names(FIXTURE_COMPOSE) == {
        "nginx",
        "tallied",
        "tallied-db",
        "deptrack-apiserver",
        "deptrack-frontend",
    }


def test_container_names_regex_fallback_on_unparseable_yaml():
    broken = "services:\n  a:\n    container_name: alpha\n  b: !!python/object:os.system x\n"
    assert cc.container_names(broken) == {"alpha"}


def test_diff_passes_when_everything_matches():
    cat = catalog(
        {"name": "nginx"},
        {"name": "tallied"},
        {"name": "tallied-db"},
        {"name": "dependency-track", "containers": ["deptrack-apiserver", "deptrack-frontend"]},
        {"name": "homelab-infra", "containers": []},
        {"name": "home-assistant", "external": True},
    )
    diff = cc.diff_catalog(cat, cc.container_names(FIXTURE_COMPOSE))
    assert diff.ok, (diff.missing_from_catalog, diff.missing_from_compose)


def test_diff_reports_containers_missing_from_catalog():
    cat = catalog({"name": "nginx"}, {"name": "tallied"})
    diff = cc.diff_catalog(cat, cc.container_names(FIXTURE_COMPOSE))
    assert diff.missing_from_catalog == ["deptrack-apiserver", "deptrack-frontend", "tallied-db"]
    assert diff.missing_from_compose == []


def test_diff_reports_catalog_entries_missing_from_compose():
    cat = catalog(
        {"name": "nginx"},
        {"name": "marimo"},
        {"name": "dependency-track", "containers": ["deptrack-apiserver", "deptrack-ui"]},
    )
    diff = cc.diff_catalog(cat, {"nginx", "deptrack-apiserver"})
    assert diff.missing_from_compose == ["dependency-track -> deptrack-ui", "marimo -> marimo"]


def test_external_and_empty_containers_are_skipped():
    cat = catalog({"name": "ha", "external": True}, {"name": "repo-only", "containers": []})
    diff = cc.diff_catalog(cat, set())
    assert diff.ok


def test_compose_paths_include_per_entry_overrides_once():
    cat = catalog(
        {"name": "a"},
        {"name": "openclaw", "compose": "infrastructure/openclaw/docker-compose.yml"},
        {"name": "openclaw-2", "compose": "infrastructure/openclaw/docker-compose.yml"},
    )
    assert cc.compose_paths(cat) == [
        "docker-compose.yml",
        "infrastructure/openclaw/docker-compose.yml",
    ]


def test_public_urls_skip_lan_only_and_non_https():
    cat = catalog(
        categories=[
            {
                "id": "custom",
                "title": "c",
                "services": [
                    {
                        "name": "site",
                        "url": "https://www.markcheli.com",
                        "repo": "https://github.com/MCheli/PersonalWebsite",
                    },
                    {"name": "lan", "url": "https://x.ops.markcheli.com", "lanOnly": True},
                    {"name": "mc", "url": "minecraft.markcheli.com:25565"},
                ],
            },
            {
                "id": "obs",
                "title": "o",
                "lanOnly": True,
                "services": [{"name": "grafana", "url": "https://dashboard.ops.markcheli.com"}],
            },
        ]
    )
    projects = {
        "projects": [
            {
                "slug": "p",
                "url": "https://p.example",
                "demo": "https://d.example",
                "repo": "https://github.com/MCheli/p",
            }
        ]
    }
    resume = {
        "basics": {
            "url": "https://www.markcheli.com",
            "profiles": [{"network": "GitHub", "url": "https://github.com/MCheli"}],
        }
    }
    urls = [u for _, u in cc.public_urls(cat, projects, resume)]
    # Exact-set comparison (CodeQL flagged `"https://…" in urls` as substring sanitization).
    assert set(urls) == {
        "https://www.markcheli.com",
        "https://github.com/MCheli",
        "https://github.com/MCheli/PersonalWebsite",
        "https://github.com/MCheli/83rr-poweredge",
        "https://p.example",
        "https://d.example",
        "https://github.com/MCheli/p",
    }
    assert len(urls) == len(set(urls))


def test_offline_main_run_with_fixture_files(tmp_path, capsys):
    (tmp_path / "docker-compose.yml").write_text(FIXTURE_COMPOSE)
    (tmp_path / "infrastructure" / "openclaw").mkdir(parents=True)
    (tmp_path / "infrastructure" / "openclaw" / "docker-compose.yml").write_text(FIXTURE_OPENCLAW)
    cat = catalog(
        {"name": "nginx"},
        {"name": "tallied"},
        {"name": "tallied-db"},
        {"name": "dependency-track", "containers": ["deptrack-apiserver", "deptrack-frontend"]},
        {"name": "openclaw", "compose": "infrastructure/openclaw/docker-compose.yml"},
    )
    cat_file = tmp_path / "services.json"
    cat_file.write_text(json.dumps(cat))
    rc = cc.main(["--offline", str(tmp_path), "--no-urls", "--catalog", str(cat_file)])
    assert rc == 0
    assert "6 containers all accounted for" in capsys.readouterr().out

    cat["categories"][0]["services"].append({"name": "marimo"})
    cat_file.write_text(json.dumps(cat))
    rc = cc.main(["--offline", str(tmp_path), "--no-urls", "--catalog", str(cat_file)])
    assert rc == 1
    assert "marimo -> marimo" in capsys.readouterr().err


def test_missing_compose_file_exits_2(tmp_path, capsys):
    cat_file = tmp_path / "services.json"
    cat_file.write_text(json.dumps(catalog({"name": "nginx"})))
    rc = cc.main(["--offline", str(tmp_path), "--no-urls", "--catalog", str(cat_file)])
    assert rc == 2
    assert "cannot read docker-compose.yml" in capsys.readouterr().err


LOCAL_CHECKOUT = Path("/home/claude/ref/83rr-poweredge")


@pytest.mark.skipif(not LOCAL_CHECKOUT.is_dir(), reason="no local 83rr-poweredge checkout")
def test_real_catalog_matches_local_compose_checkout():
    """When a checkout of the homelab repo is on disk, the committed catalog must match it."""
    rc = cc.main(["--offline", str(LOCAL_CHECKOUT), "--no-urls"])
    assert rc == 0
