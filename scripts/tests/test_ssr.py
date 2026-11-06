"""Server-rendered output of the built site (READ-001, READ-002, NFR-SEC-001).

Starts frontend/.output/server/index.mjs on a free port and fetches the pages with no
JavaScript runtime, the way a crawler or an assistant does. Skips when there is no build
(`make build` first); CI builds before `make test`.
"""

from __future__ import annotations

import html as html_lib
import json
import os
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SERVER = REPO / "frontend" / ".output" / "server" / "index.mjs"
CONTENT = REPO / "content"

pytestmark = pytest.mark.skipif(not SERVER.exists(), reason="no frontend build (run make build)")


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def site():
    port = _free_port()
    proc = subprocess.Popen(
        ["node", str(SERVER)],
        env={**os.environ, "PORT": str(port), "HOST": "127.0.0.1", "NODE_ENV": "production"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(base + "/", timeout=2).read()
                break
            except (OSError, urllib.error.URLError):
                time.sleep(0.5)
        else:
            raise RuntimeError("built site did not start")
        yield base
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def _get(base: str, path: str) -> str:
    with urllib.request.urlopen(base + path, timeout=10) as r:
        assert r.status == 200, (path, r.status)
        # Unescape so "&amp;" in SSR'd text compares equal to the JSON source.
        return html_lib.unescape(r.read().decode("utf-8"))


def _load(name: str) -> dict:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


def test_home_is_readable_without_javascript(site):
    html = _get(site, "/")
    resume = _load("resume.json")
    work = resume["work"][0]
    assert work["position"] in html
    assert resume["basics"]["summary"][:60] in html
    for project in _load("projects.json")["projects"]:
        assert project["name"] in html, project["name"]
    for category in _load("services.json")["categories"]:
        for service in category["services"]:
            assert service["name"] in html, service["name"]
    for profile in resume["basics"]["profiles"]:
        assert profile["url"] in html


def test_resume_and_projects_pages_render_server_side(site):
    resume = _get(site, "/resume")
    for entry in _load("resume.json")["work"]:
        assert entry["position"] in resume, entry["position"]
    assert "/Mark-Cheli-Resume.pdf" in resume

    projects = _get(site, "/projects")
    for project in _load("projects.json")["projects"]:
        assert f'id="{project["slug"]}"' in projects, project["slug"]


def test_json_ld_person_comes_from_resume(site):
    html = _get(site, "/")
    scripts = re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL
    )
    assert scripts, "no JSON-LD on /"
    graph = json.loads(scripts[0])
    nodes = graph.get("@graph", [graph])
    person = next(n for n in nodes if n.get("@type") == "Person")
    resume = _load("resume.json")
    assert person["name"] == resume["basics"]["name"]
    assert person["jobTitle"] == resume["work"][0]["position"]
    assert set(person["sameAs"]) == {p["url"] for p in resume["basics"]["profiles"]}


def test_no_third_party_requests_on_page_load(site):
    html = _get(site, "/")
    assert "fonts.googleapis.com" not in html
    assert "fonts.gstatic.com" not in html
    assert 'property="og:image" content="https://www.markcheli.com/og.png"' in html


def test_security_headers_present(site):
    with urllib.request.urlopen(site + "/", timeout=10) as r:
        headers = {k.lower(): v for k, v in r.headers.items()}
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "frame-ancestors 'none'" in headers.get("content-security-policy", "")
