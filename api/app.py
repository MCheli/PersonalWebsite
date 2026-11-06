#!/usr/bin/env python3
"""Flask API behind markcheli.com (flask.markcheli.com).

Serves the content files in ../content as JSON (resume, projects, services, now,
profile) with permissive CORS, plus a cached weather endpoint. Every fact comes
from content/; nothing about Mark is hard-coded here.
"""

import json
import logging
import os
import re
import threading
import time
from datetime import UTC, datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

# Weather API configuration
WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "demo-key")
ASHLAND_LAT = 42.2612
ASHLAND_LON = -71.4633
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
WEATHER_CACHE_TTL = 600  # seconds; a burst of visitors makes one upstream call
APPID_PATTERN = re.compile(r'(appid=)[^&\s\'"]+', re.IGNORECASE)

# Content: api/content is a symlink to ../content in the repo; the Dockerfile copies
# the real directory in its place, so both resolve relative to app.py. Each file is
# read once at import (gunicorn workers each load their own copy; content only
# changes with a deploy).
CONTENT_DIR = Path(__file__).parent / "content"


def _load(name: str) -> dict:
    with (CONTENT_DIR / name).open(encoding="utf-8") as f:
        return json.load(f)


CATALOG = _load("services.json")
RESUME = _load("resume.json")
PROJECTS = _load("projects.json")
NOW = _load("now.json")

ENDPOINTS = [
    "/health",
    "/ping",
    "/weather",
    "/profile",
    "/services",
    "/resume",
    "/projects",
    "/now",
]


def now_iso() -> str:
    """Timezone-aware UTC timestamp (datetime.utcnow is deprecated and naive)."""
    return datetime.now(UTC).isoformat()


def redact_api_key(text: str) -> str:
    """Strip the OpenWeatherMap key from text bound for the logs."""
    text = APPID_PATTERN.sub(r"\1REDACTED", text)
    if WEATHER_API_KEY and WEATHER_API_KEY != "demo-key":
        text = text.replace(WEATHER_API_KEY, "REDACTED")
    return text


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint (the container HEALTHCHECK polls it)."""
    return jsonify({"status": "healthy", "timestamp": now_iso(), "service": "mark-cheli-api"})


@app.route("/ping", methods=["GET"])
def ping():
    """Liveness check."""
    return jsonify({"message": "pong", "timestamp": now_iso(), "server": "Mark Cheli Personal API"})


# --- weather -------------------------------------------------------------------
#
# Module-level cache: one (fetched_at, payload) pair per process. gunicorn runs
# several workers and each keeps its own copy, so the worst case is one upstream
# call per worker per TTL, which is still a handful of calls an hour instead of
# one per visitor. The lock keeps two threads in one worker from both fetching.
_weather_cache: dict = {"fetched_at": 0.0, "payload": None}
_weather_lock = threading.Lock()


def _fetch_weather() -> dict:
    """One OpenWeatherMap call, shaped for the terminal's `weather` command."""
    params = {"lat": ASHLAND_LAT, "lon": ASHLAND_LON, "appid": WEATHER_API_KEY, "units": "imperial"}
    response = requests.get(WEATHER_URL, params=params, timeout=5)
    response.raise_for_status()
    data = response.json()
    return {
        "location": "Ashland, MA",
        "temperature": round(data["main"]["temp"]),
        "feels_like": round(data["main"]["feels_like"]),
        "humidity": data["main"]["humidity"],
        "description": data["weather"][0]["description"].title(),
        "wind_speed": round(data["wind"]["speed"]),
        "timestamp": now_iso(),
        "source": "OpenWeatherMap",
    }


def _cached_weather() -> tuple[dict, bool]:
    """Return (payload, from_cache); refreshes when older than WEATHER_CACHE_TTL."""
    with _weather_lock:
        age = time.monotonic() - _weather_cache["fetched_at"]
        if _weather_cache["payload"] is not None and age < WEATHER_CACHE_TTL:
            return _weather_cache["payload"], True
        payload = _fetch_weather()
        _weather_cache["payload"] = payload
        _weather_cache["fetched_at"] = time.monotonic()
        return payload, False


@app.route("/weather", methods=["GET"])
def get_weather():
    """Current weather for Ashland, MA; cached for 10 minutes per worker."""
    if not WEATHER_API_KEY or WEATHER_API_KEY == "demo-key":
        return jsonify(
            {
                "location": "Ashland, MA",
                "temperature": 72,
                "feels_like": 75,
                "humidity": 65,
                "description": "Partly Cloudy",
                "wind_speed": 8,
                "timestamp": now_iso(),
                "source": "Demo Data",
                "note": "Set OPENWEATHER_API_KEY environment variable for live data",
            }
        )
    try:
        payload, from_cache = _cached_weather()
        return jsonify({**payload, "cached": from_cache})
    except requests.RequestException as e:
        # A RequestException's message (and so its traceback) includes the upstream
        # URL, which carries the appid. Logs ship to OpenSearch, so log only the
        # exception type and a redacted message, never the raw traceback.
        app.logger.error(
            "Weather upstream request failed: %s: %s", type(e).__name__, redact_api_key(str(e))
        )
        return jsonify({"error": "Weather service unavailable", "timestamp": now_iso()}), 503
    except Exception as e:  # last line of defence: never leak the key
        app.logger.error(
            "Weather endpoint failed: %s: %s", type(e).__name__, redact_api_key(str(e))
        )
        return jsonify({"error": "Internal server error", "timestamp": now_iso()}), 500


# --- content -------------------------------------------------------------------


@app.route("/profile", methods=["GET"])
def get_profile():
    """Identity plus the full homelab catalog, from services.json.

    The same file the terminal renders its `homelab` command from, so the two
    surfaces can't drift. `links` is a flat name -> url lookup for consumers that
    just want the URLs.
    """
    profile = CATALOG["profile"]
    categories = CATALOG["categories"]

    links = {"linkedin": profile["linkedin"], "github": profile["github"]}
    for cat in categories:
        for svc in cat["services"]:
            if "url" in svc and svc["url"].startswith("http"):
                links.setdefault(svc["name"].replace("-", "_"), svc["url"])
    # Stable alias the terminal and older clients rely on
    links["home_assistant"] = "https://home.markcheli.com"

    return jsonify(
        {
            "name": profile["name"],
            "title": profile["title"],
            "company": profile.get("company"),
            "location": profile["location"],
            "email": profile.get("email"),
            "website": profile.get("website"),
            "links": links,
            "host": CATALOG["host"],
            "categories": categories,
            "service_count": sum(len(cat["services"]) for cat in categories),
            "timestamp": now_iso(),
        }
    )


@app.route("/services", methods=["GET"])
def get_services():
    """Raw service catalog (content/services.json)."""
    return jsonify(CATALOG)


@app.route("/resume", methods=["GET"])
def get_resume():
    """JSON Resume (content/resume.json)."""
    return jsonify(RESUME)


@app.route("/projects", methods=["GET"])
def get_projects():
    """Portfolio projects (content/projects.json)."""
    return jsonify(PROJECTS)


@app.route("/now", methods=["GET"])
def get_now():
    """What Mark is doing now (content/now.json)."""
    return jsonify(NOW)


@app.errorhandler(404)
def not_found(_error):
    return jsonify(
        {"error": "Endpoint not found", "available_endpoints": ENDPOINTS, "timestamp": now_iso()}
    ), 404


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_ENV") == "development"
    logging.basicConfig(level=logging.INFO)
    app.logger.info(
        "Starting Mark Cheli Personal API on port %s (debug=%s, weather=%s)",
        port,
        debug,
        "live" if WEATHER_API_KEY != "demo-key" else "demo",
    )
    app.run(host="0.0.0.0", port=port, debug=debug)  # the container binds all interfaces
