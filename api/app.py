#!/usr/bin/env python3
"""
Personal Website Flask API Server
Provides backend services for Mark Cheli's personal website
"""
import json
import os
import requests
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Weather API configuration
WEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'demo-key')
ASHLAND_LAT = 42.2612
ASHLAND_LON = -71.4633

# Service catalog — single source of truth shared with the frontend.
# Symlinked from api/services.json -> ../services.json so pytest and Docker
# both resolve it alongside app.py.
CATALOG_PATH = Path(__file__).parent / 'services.json'
with CATALOG_PATH.open() as f:
    CATALOG = json.load(f)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'mark-cheli-api'
    })

@app.route('/ping', methods=['GET'])
def ping():
    """Simple ping endpoint"""
    return jsonify({
        'message': 'pong',
        'timestamp': datetime.utcnow().isoformat(),
        'server': 'Mark Cheli Personal API'
    })

@app.route('/weather', methods=['GET'])
def get_weather():
    """Get current weather for Ashland, MA"""
    try:
        # Use OpenWeatherMap API if key is available, otherwise return mock data
        if WEATHER_API_KEY and WEATHER_API_KEY != 'demo-key':
            weather_url = f"https://api.openweathermap.org/data/2.5/weather"
            params = {
                'lat': ASHLAND_LAT,
                'lon': ASHLAND_LON,
                'appid': WEATHER_API_KEY,
                'units': 'imperial'
            }

            response = requests.get(weather_url, params=params, timeout=5)
            response.raise_for_status()
            weather_data = response.json()

            return jsonify({
                'location': 'Ashland, MA',
                'temperature': round(weather_data['main']['temp']),
                'feels_like': round(weather_data['main']['feels_like']),
                'humidity': weather_data['main']['humidity'],
                'description': weather_data['weather'][0]['description'].title(),
                'wind_speed': round(weather_data['wind']['speed']),
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'OpenWeatherMap'
            })
        else:
            # Return mock weather data for demo
            return jsonify({
                'location': 'Ashland, MA',
                'temperature': 72,
                'feels_like': 75,
                'humidity': 65,
                'description': 'Partly Cloudy',
                'wind_speed': 8,
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'Demo Data',
                'note': 'Set OPENWEATHER_API_KEY environment variable for live data'
            })

    except requests.RequestException as e:
        return jsonify({
            'error': 'Weather service unavailable',
            'message': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503
    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/profile', methods=['GET'])
def get_profile():
    """Get Mark Cheli's profile and full homelab catalog.

    Sourced from services.json — the same file the frontend terminal renders
    its `services` command from, so the two surfaces can't drift.
    """
    profile = CATALOG['profile']
    categories = CATALOG['categories']

    # Flat lookup for consumers that just want the URLs
    links = {
        'linkedin': profile['linkedin'],
        'github': profile['github']
    }
    for cat in categories:
        for svc in cat['services']:
            if 'url' in svc and svc['url'].startswith('http'):
                # normalize name → snake_case for link key
                key = svc['name'].replace('-', '_')
                links.setdefault(key, svc['url'])
    # Stable alias the terminal and older clients rely on
    links['home_assistant'] = 'https://home.markcheli.com'

    return jsonify({
        'name': profile['name'],
        'title': profile['title'],
        'location': profile['location'],
        'links': links,
        'host': CATALOG['host'],
        'categories': categories,
        'service_count': sum(len(cat['services']) for cat in categories),
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/services', methods=['GET'])
def get_services():
    """Raw service catalog — the single source of truth."""
    return jsonify(CATALOG)

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'available_endpoints': ['/ping', '/health', '/weather', '/profile', '/services'],
        'timestamp': datetime.utcnow().isoformat()
    }), 404

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'

    print(f"🚀 Starting Mark Cheli Personal API on port {port}")
    print(f"📊 Debug mode: {debug}")
    print(f"🌤️  Weather API: {'Live' if WEATHER_API_KEY != 'demo-key' else 'Demo mode'}")

    app.run(host='0.0.0.0', port=port, debug=debug)