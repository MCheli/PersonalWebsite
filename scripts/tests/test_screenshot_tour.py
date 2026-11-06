"""End-to-end test of scripts/screenshot_tour.mjs against a fixture site.

Serves a tiny static site with python's http.server and runs the tour with
TOUR_BASE_URL: the home page fits, /projects overflows horizontally, /resume is a 404.
Skipped when node, frontend/node_modules/playwright or a Chrome binary is missing
(the CI test job has all three: ubuntu-latest ships /usr/bin/google-chrome).
"""

import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TOUR = REPO_ROOT / "scripts" / "screenshot_tour.mjs"
PLAYWRIGHT = REPO_ROOT / "frontend" / "node_modules" / "playwright" / "package.json"
CHROME = os.environ.get("PLAYWRIGHT_CHROME") or "/usr/bin/google-chrome"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or not PLAYWRIGHT.exists() or not Path(CHROME).exists(),
    reason="needs node, frontend/node_modules/playwright and a Chrome binary",
)

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'
HOME = f"<!doctype html>{VIEWPORT}<title>home</title><main><h1>Mark Cheli</h1><p>fits</p></main>"
WIDE = (
    f"<!doctype html>{VIEWPORT}<title>projects</title><main>"
    '<div style="width:2000px;height:20px;background:#0f0">too wide</div></main>'
)


@pytest.fixture
def site(tmp_path):
    (tmp_path / "index.html").write_text(HOME)
    (tmp_path / "projects").mkdir()
    (tmp_path / "projects" / "index.html").write_text(WIDE)

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(tmp_path), **kw)

        def log_message(self, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Quiet) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        yield f"http://127.0.0.1:{httpd.server_address[1]}"
        httpd.shutdown()


def run_tour(base_url, out, *extra):
    env = {**os.environ, "TOUR_BASE_URL": base_url, "PLAYWRIGHT_CHROME": CHROME}
    return subprocess.run(
        ["node", str(TOUR), "--out", str(out), *extra, "home", "resume", "projects"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )


def test_tour_captures_skips_404_and_fails_on_overflow(site, tmp_path):
    out = tmp_path / "screens"
    result = run_tour(site, out)
    assert result.returncode == 1, result.stdout + result.stderr
    assert "resume/mobile: SKIPPED" in result.stderr
    assert "projects/mobile (scrollWidth" in result.stderr

    for name in ("home", "projects"):
        for vp in ("mobile", "desktop"):
            png = out / name / f"{vp}.png"
            assert png.exists() and png.stat().st_size > 1000, png
    assert not (out / "resume").exists()

    log = json.loads((out / "tour-log.json").read_text())["captures"]
    assert log["home/mobile"]["overflow"] is False
    assert log["home/mobile"]["innerWidth"] == 390
    assert log["home/desktop"]["innerWidth"] == 1440
    assert log["projects/mobile"]["overflow"] is True
    assert log["projects/desktop"]["overflow"] is True
    assert log["resume/mobile"]["skipped"] is True


def test_tour_allow_overflow_exits_zero(site, tmp_path):
    result = run_tour(site, tmp_path / "screens", "--allow-overflow")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "(allowed)" in result.stderr


@pytest.mark.skipif(sys.platform == "win32", reason="posix only")
def test_tour_unknown_capture_name_exits_2(tmp_path):
    env = {**os.environ, "TOUR_BASE_URL": "http://127.0.0.1:9"}
    result = subprocess.run(
        ["node", str(TOUR), "--out", str(tmp_path), "nope"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 2
    assert "no such capture" in result.stderr
