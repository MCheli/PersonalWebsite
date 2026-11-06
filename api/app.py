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
from flask import Flask, jsonify, request
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

# Contact form -> ntfy. The homelab compose sets NTFY_PUBLISH_TOKEN on flask-api; without it
# the endpoint answers 503 rather than dropping messages silently.
NTFY_URL = os.getenv("NTFY_URL", "http://ntfy").rstrip("/")
NTFY_TOPIC = os.getenv("NTFY_TOPIC", "homelab")
NTFY_PUBLISH_TOKEN = os.getenv("NTFY_PUBLISH_TOKEN", "")
CONTACT_RATE_LIMIT = 3  # messages per CONTACT_RATE_WINDOW per client IP
CONTACT_RATE_WINDOW = 3600  # seconds (rolling)

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
    "/contact",
]


def now_iso() -> str:
    """Timezone-aware UTC timestamp (datetime.utcnow is deprecated and naive)."""
    return datetime.now(UTC).isoformat()


def redact_api_key(text: str) -> str:
    """Strip the OpenWeatherMap key and the ntfy token from text bound for the logs."""
    text = APPID_PATTERN.sub(r"\1REDACTED", text)
    if WEATHER_API_KEY and WEATHER_API_KEY != "demo-key":
        text = text.replace(WEATHER_API_KEY, "REDACTED")
    if NTFY_PUBLISH_TOKEN:
        text = text.replace(NTFY_PUBLISH_TOKEN, "REDACTED")
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
    """Identity (from resume.json) plus the full homelab catalog (from services.json).

    The same files the terminal renders from, so the surfaces can't drift. `links`
    is a flat name -> url lookup for consumers that just want the URLs.
    """
    basics = RESUME["basics"]
    location = basics.get("location", {})
    current = RESUME["work"][0] if RESUME.get("work") else {}
    categories = CATALOG["categories"]

    links = {p["network"].lower(): p["url"] for p in basics.get("profiles", [])}
    for cat in categories:
        for svc in cat["services"]:
            if "url" in svc and svc["url"].startswith("http"):
                links.setdefault(svc["name"].replace("-", "_"), svc["url"])

    return jsonify(
        {
            "name": basics["name"],
            "title": current.get("position", basics.get("label")),
            "company": current.get("name"),
            "location": ", ".join(
                v for v in (location.get("city"), location.get("region")) if isinstance(v, str)
            ),
            "email": basics.get("email"),
            "website": basics.get("url"),
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


# --- contact -------------------------------------------------------------------
#
# Per-IP rate limit: a module-level {ip: [timestamps]} dict guarded by a lock. gunicorn
# runs several workers and each keeps its own copy, so the effective limit is up to
# CONTACT_RATE_LIMIT per worker per hour; good enough to stop a loop, not a quota.
_contact_hits: dict[str, list[float]] = {}
_contact_lock = threading.Lock()


def client_ip() -> str:
    """The visitor's IP behind nginx: X-Real-IP, else the first X-Forwarded-For hop."""
    real = (request.headers.get("X-Real-IP") or "").strip()
    if real:
        return real
    forwarded = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    return forwarded or (request.remote_addr or "unknown")


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    with _contact_lock:
        if len(_contact_hits) > 1000:  # forget IPs whose window has fully expired
            expired = [
                k for k, v in _contact_hits.items() if not v or now - v[-1] >= CONTACT_RATE_WINDOW
            ]
            for k in expired:
                del _contact_hits[k]
        hits = [t for t in _contact_hits.get(ip, []) if now - t < CONTACT_RATE_WINDOW]
        if len(hits) >= CONTACT_RATE_LIMIT:
            _contact_hits[ip] = hits
            return True
        hits.append(now)
        _contact_hits[ip] = hits
        return False


def _looks_like_email(value: str) -> bool:
    """One '@', a dot in the domain, no whitespace. Linear-time on purpose (no regex)."""
    local, sep, domain = value.partition("@")
    return (
        bool(sep)
        and bool(local)
        and "@" not in domain
        and "." in domain.strip(".")
        and not any(c.isspace() for c in value)
    )


def _ascii_title(name: str) -> str:
    try:
        name.encode("latin-1")
    except UnicodeEncodeError:
        return "Website message"
    return f"Website message from {name}"


def validate_contact(body: dict) -> tuple[dict | None, tuple[str, str] | None]:
    """Return (clean fields, None) or (None, (error message, field))."""

    def text(key: str) -> str:
        value = body.get(key, "")
        if not isinstance(value, str):
            return ""
        # Control characters never belong in a name, address or note; they would also
        # break the ntfy headers the name is placed in.
        return "".join(ch for ch in value if ch.isprintable() or ch in "\n\t").strip()

    name, email, message = text("name"), text("email"), text("message")
    name = " ".join(name.split())  # one line, single spaces
    if not 1 <= len(name) <= 100:
        return None, ("Name must be 1 to 100 characters", "name")
    if len(email) > 254 or not _looks_like_email(email):
        return None, ("Enter a valid email address", "email")
    if not 10 <= len(message) <= 2000:
        return None, ("Message must be 10 to 2000 characters", "message")
    return {"name": name, "email": email, "message": message}, None


@app.route("/contact", methods=["POST"])
def post_contact():
    """Contact form: validates, rate-limits per IP, publishes to ntfy.

    `website` is a honeypot field: bots fill it, people never see it. A non-empty value
    gets a 200 and nothing else, so the bot cannot tell it was caught.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Send a JSON object", "field": "body"}), 400
    if str(body.get("website") or "").strip():
        return jsonify({"ok": True})
    fields, problem = validate_contact(body)
    if problem:
        message, field = problem
        return jsonify({"error": message, "field": field}), 400
    if _rate_limited(client_ip()):
        return jsonify({"error": "Too many messages; try again later"}), 429
    if not NTFY_PUBLISH_TOKEN:
        app.logger.error("Contact message dropped: NTFY_PUBLISH_TOKEN is not set")
        return jsonify({"error": "Contact is not configured"}), 503
    try:
        response = requests.post(
            f"{NTFY_URL}/{NTFY_TOPIC}",
            headers={
                "Authorization": f"Bearer {NTFY_PUBLISH_TOKEN}",
                # HTTP headers are latin-1; a name outside that range goes in the body only.
                "Title": _ascii_title(fields["name"]),
                "Tags": "envelope",
                "Priority": "4",
            },
            data=f"{fields['message']}\n\nFrom: {fields['name']} <{fields['email']}>".encode(),
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        app.logger.error(
            "Contact delivery to ntfy failed: %s: %s", type(e).__name__, redact_api_key(str(e))
        )
        return jsonify({"error": "Could not deliver the message"}), 502
    return jsonify({"ok": True})


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
