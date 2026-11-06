#!/usr/bin/env python3
"""Tests for the markcheli.com Flask API.

pytest.ini turns the utcnow DeprecationWarning into an error, so a regression to
naive timestamps fails the run.
"""

import json
from datetime import datetime
from pathlib import Path

import pytest
import requests

import app as app_module
from app import app

CONTENT = Path(__file__).parent / "content"


@pytest.fixture
def client():
    """Test client fixture"""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def live_weather(monkeypatch):
    """Pretend a real key is configured and reset the cache around the test."""
    monkeypatch.setattr(app_module, "WEATHER_API_KEY", "test-key")
    monkeypatch.setitem(app_module._weather_cache, "payload", None)
    monkeypatch.setitem(app_module._weather_cache, "fetched_at", 0.0)
    yield


class FakeResponse:
    def __init__(self, temp=50.4):
        self._data = {
            "main": {"temp": temp, "feels_like": temp - 3, "humidity": 40},
            "weather": [{"description": "clear sky"}],
            "wind": {"speed": 4.6},
        }

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["status"] == "healthy"
    assert data["service"] == "mark-cheli-api"
    assert datetime.fromisoformat(data["timestamp"]).tzinfo is not None


def test_ping_endpoint(client):
    response = client.get("/ping")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["message"] == "pong"
    assert data["server"] == "Mark Cheli Personal API"
    assert datetime.fromisoformat(data["timestamp"]).tzinfo is not None


def test_timestamps_are_timezone_aware(client):
    """Every timestamp is an aware ISO string ending in +00:00, never naive utcnow()."""
    for path in ("/health", "/ping", "/weather", "/profile", "/nonexistent"):
        data = json.loads(client.get(path).data)
        assert data["timestamp"].endswith("+00:00"), path


def test_weather_endpoint(client):
    """Without a key the endpoint returns demo data."""
    response = client.get("/weather")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["location"] == "Ashland, MA"
    assert "temperature" in data
    assert "humidity" in data
    assert "description" in data
    assert "timestamp" in data
    assert data["source"] == "Demo Data"


def test_weather_endpoint_structure(client):
    data = json.loads(client.get("/weather").data)
    for field in ["location", "temperature", "humidity", "description", "timestamp", "source"]:
        assert field in data
    assert isinstance(data["temperature"], (int, float))
    assert isinstance(data["humidity"], (int, float))


def test_weather_is_cached_for_ten_minutes(client, live_weather, monkeypatch):
    """A burst of requests makes exactly one OpenWeatherMap call."""
    calls = []

    def fake_get(url, params=None, timeout=None):
        calls.append(params)
        return FakeResponse()

    monkeypatch.setattr(app_module.requests, "get", fake_get)
    first = json.loads(client.get("/weather").data)
    second = json.loads(client.get("/weather").data)
    third = json.loads(client.get("/weather").data)

    assert len(calls) == 1
    assert calls[0]["appid"] == "test-key"
    assert first["source"] == "OpenWeatherMap"
    assert first["temperature"] == 50
    assert first["cached"] is False
    assert second["cached"] is True and third["cached"] is True
    assert second["temperature"] == first["temperature"]


def test_weather_cache_expires(client, live_weather, monkeypatch):
    """After WEATHER_CACHE_TTL seconds the next request refreshes upstream."""
    calls = []
    clock = {"now": 1000.0}

    def fake_get(url, params=None, timeout=None):
        calls.append(params)
        return FakeResponse(temp=60 + len(calls))

    monkeypatch.setattr(app_module.requests, "get", fake_get)
    monkeypatch.setattr(app_module.time, "monotonic", lambda: clock["now"])

    client.get("/weather")
    clock["now"] += app_module.WEATHER_CACHE_TTL - 1
    cached = json.loads(client.get("/weather").data)
    assert len(calls) == 1 and cached["cached"] is True

    clock["now"] += 2  # now past the TTL
    fresh = json.loads(client.get("/weather").data)
    assert len(calls) == 2
    assert fresh["cached"] is False
    assert fresh["temperature"] == 62


def test_weather_error_does_not_leak_api_key(client, live_weather, monkeypatch):
    """Upstream errors must not echo the request URL, which contains the appid"""

    def fail(*args, **kwargs):
        raise requests.ConnectionError(
            "Max retries exceeded with url: /data/2.5/weather?appid=secret-key-123"
        )

    monkeypatch.setattr(app_module, "WEATHER_API_KEY", "secret-key-123")
    monkeypatch.setattr(app_module.requests, "get", fail)
    response = client.get("/weather")
    assert response.status_code == 503
    assert b"secret-key-123" not in response.data


def test_weather_error_does_not_log_api_key(client, live_weather, monkeypatch, caplog):
    """Upstream errors must not write the appid to the logs, which ship to OpenSearch"""
    import logging

    key = "fake-key-abc123"

    def fail(*args, **kwargs):
        raise requests.ConnectionError(
            "HTTPSConnectionPool(host='api.openweathermap.org', port=443): "
            f"Max retries exceeded with url: /data/2.5/weather?lat=42.2612&appid={key}&units=imperial"
        )

    monkeypatch.setattr(app_module, "WEATHER_API_KEY", key)
    monkeypatch.setattr(app_module.requests, "get", fail)
    with caplog.at_level(logging.DEBUG):
        response = client.get("/weather")

    assert response.status_code == 503
    assert key.encode() not in response.data
    assert caplog.records, "expected the failure to be logged"
    assert key not in caplog.text
    for record in caplog.records:
        assert key not in record.getMessage()
        assert record.exc_info is None
    assert "ConnectionError" in caplog.text
    assert "appid=REDACTED" in caplog.text


def test_weather_error_is_not_cached(client, live_weather, monkeypatch):
    """A failed upstream call leaves the cache empty so the next visitor retries."""
    calls = []

    def flaky(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise requests.ConnectionError("boom")
        return FakeResponse()

    monkeypatch.setattr(app_module.requests, "get", flaky)
    assert client.get("/weather").status_code == 503
    assert client.get("/weather").status_code == 200
    assert len(calls) == 2


def test_profile_endpoint(client):
    """Profile identity comes from services.json's profile block."""
    catalog = json.loads((CONTENT / "services.json").read_text())
    response = client.get("/profile")
    assert response.status_code == 200

    data = json.loads(response.data)
    profile = catalog["profile"]
    assert data["name"] == profile["name"]
    assert data["title"] == profile["title"]
    assert data["company"] == profile["company"]
    assert data["location"] == profile["location"]
    assert data["email"] == profile["email"]
    assert data["website"] == profile["website"]

    links = data["links"]
    assert links["linkedin"] == profile["linkedin"]
    assert links["github"] == profile["github"]
    assert "home_assistant" in links

    host = data["host"]
    assert host["hardware"] == catalog["host"]["hardware"]

    assert isinstance(data["categories"], list)
    assert len(data["categories"]) > 0
    assert data["service_count"] == sum(len(c["services"]) for c in data["categories"])


def test_profile_catalog_is_from_services_json(client):
    """Profile reflects the shared services.json, so adding a service in one place
    shows up for both API consumers and the terminal."""
    catalog = json.loads((CONTENT / "services.json").read_text())
    data = json.loads(client.get("/profile").data)
    assert data["categories"] == catalog["categories"]

    names = {svc["name"] for cat in data["categories"] for svc in cat["services"]}
    assert {"personal-website", "flask-api", "cookbook", "tallied"} <= names
    assert {"plex", "seafile", "grafana"} <= names

    for cat in data["categories"]:
        assert cat["id"] and cat["title"]
        for svc in cat["services"]:
            assert "name" in svc
            if "url" in svc:
                assert svc["url"].startswith(("http://", "https://")) or ":" in svc["url"]


def test_services_endpoint(client):
    """/services is content/services.json verbatim."""
    response = client.get("/services")
    assert response.status_code == 200
    assert json.loads(response.data) == json.loads((CONTENT / "services.json").read_text())


def test_resume_endpoint(client):
    """/resume is content/resume.json verbatim (JSON Resume)."""
    response = client.get("/resume")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == json.loads((CONTENT / "resume.json").read_text())
    assert data["basics"]["name"] == "Mark Cheli"
    assert "work" in data and "meta" in data


def test_projects_endpoint(client):
    """/projects is content/projects.json verbatim."""
    response = client.get("/projects")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == json.loads((CONTENT / "projects.json").read_text())
    assert all("slug" in p for p in data["projects"])


def test_now_endpoint(client):
    """/now is content/now.json verbatim."""
    response = client.get("/now")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == json.loads((CONTENT / "now.json").read_text())
    assert isinstance(data["items"], list)


def test_404_handler(client):
    """The 404 body lists every endpoint the app registers."""
    response = client.get("/nonexistent")
    assert response.status_code == 404

    data = json.loads(response.data)
    assert data["error"] == "Endpoint not found"
    listed = set(data["available_endpoints"])
    registered = {rule.rule for rule in app.url_map.iter_rules() if rule.endpoint != "static"}
    assert listed == registered
    assert {
        "/ping",
        "/health",
        "/weather",
        "/profile",
        "/services",
        "/resume",
        "/projects",
        "/now",
    } <= listed


def test_cors_headers(client):
    """Every endpoint answers with permissive CORS so assistants can fetch JSON."""
    for path in ("/ping", "/resume", "/projects", "/services", "/profile", "/now"):
        response = client.get(path, headers={"Origin": "https://example.com"})
        assert response.headers.get("Access-Control-Allow-Origin") in (
            "*",
            "https://example.com",
        ), path


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
