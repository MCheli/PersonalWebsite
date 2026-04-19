#!/usr/bin/env python3
"""
Tests for Personal Website Flask API
"""
import pytest
import json
from app import app

@pytest.fixture
def client():
    """Test client fixture"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['status'] == 'healthy'
    assert 'timestamp' in data
    assert data['service'] == 'mark-cheli-api'

def test_ping_endpoint(client):
    """Test ping endpoint"""
    response = client.get('/ping')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['message'] == 'pong'
    assert 'timestamp' in data
    assert data['server'] == 'Mark Cheli Personal API'

def test_weather_endpoint(client):
    """Test weather endpoint"""
    response = client.get('/weather')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['location'] == 'Ashland, MA'
    assert 'temperature' in data
    assert 'humidity' in data
    assert 'description' in data
    assert 'timestamp' in data

    # Should return demo data since no API key is set in tests
    assert data['source'] == 'Demo Data'

def test_profile_endpoint(client):
    """Test profile endpoint returns identity + catalog"""
    response = client.get('/profile')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['name'] == 'Mark Cheli'
    assert data['title'] == 'Developer'
    assert data['location'] == 'Ashland, MA'

    # Professional links are always present
    links = data['links']
    assert 'linkedin' in links
    assert 'github' in links
    assert 'home_assistant' in links

    # Host block reflects the real homelab
    host = data['host']
    assert host['hardware'] == 'Dell PowerEdge R630'
    assert 'Ubuntu' in host['os']

    # Full catalog is embedded
    assert isinstance(data['categories'], list)
    assert len(data['categories']) > 0
    assert data['service_count'] == sum(len(c['services']) for c in data['categories'])

def test_profile_catalog_is_from_services_json(client):
    """Profile should reflect the shared services.json, so adding a
    service in one place shows up for both API consumers and the
    terminal site."""
    response = client.get('/profile')
    data = json.loads(response.data)

    # Flatten all services and assert the expected real-world ones are present
    names = {svc['name'] for cat in data['categories'] for svc in cat['services']}
    assert {'personal-website', 'flask-api', 'cookbook', 'tallied'} <= names
    assert {'plex', 'seafile', 'marimo', 'grafana'} <= names

    # Every service has the required shape
    for cat in data['categories']:
        assert cat['id'] and cat['title']
        for svc in cat['services']:
            assert 'name' in svc
            # url is optional for backend-only containers; when present, must be http(s)
            if 'url' in svc:
                assert svc['url'].startswith(('http://', 'https://')) or ':' in svc['url']

def test_services_endpoint(client):
    """/services exposes the raw catalog as the single source of truth"""
    response = client.get('/services')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert 'host' in data
    assert 'categories' in data
    assert data['host']['displayName'] == '83RR PowerEdge'

def test_404_handler(client):
    """Test 404 error handler"""
    response = client.get('/nonexistent')
    assert response.status_code == 404

    data = json.loads(response.data)
    assert data['error'] == 'Endpoint not found'
    assert 'available_endpoints' in data

    endpoints = data['available_endpoints']
    assert '/ping' in endpoints
    assert '/health' in endpoints
    assert '/weather' in endpoints
    assert '/profile' in endpoints
    assert '/services' in endpoints

def test_cors_headers(client):
    """Test CORS headers are present"""
    response = client.get('/ping')
    assert 'Access-Control-Allow-Origin' in response.headers

def test_weather_endpoint_structure(client):
    """Test weather endpoint returns proper structure"""
    response = client.get('/weather')
    data = json.loads(response.data)

    required_fields = ['location', 'temperature', 'humidity', 'description', 'timestamp', 'source']
    for field in required_fields:
        assert field in data

    assert isinstance(data['temperature'], (int, float))
    assert isinstance(data['humidity'], (int, float))

if __name__ == '__main__':
    pytest.main([__file__, '-v'])