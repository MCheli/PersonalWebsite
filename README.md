# Personal Website

A terminal-style personal website built with Nuxt 3 and a Flask API backend, deployed as Docker containers via GitHub Actions.

## Architecture

```
frontend/   → Nuxt 3 SSR app (Vue 3, terminal UI)
api/        → Flask REST API
```

Both services are published as Docker images to GitHub Container Registry on push to `master`.

## Frontend

- **Framework:** Nuxt 3 with Vue 3 and server-side rendering
- **Style:** Interactive terminal interface using JetBrains Mono font
- **Port:** 3000
- **Image:** `ghcr.io/mcheli/personal-website`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_API_BASE` | API backend URL (default: `http://localhost:5000`) |

## API

- **Framework:** Flask 3.0 with Gunicorn
- **Port:** 5000
- **Image:** `ghcr.io/mcheli/flask-api`

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Health check |
| `/ping` | Liveness check |
| `/weather` | Weather data via OpenWeatherMap |
| `/profile` | Links to personal services |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key |
| `FLASK_ENV` | Flask environment (`production`, `development`) |
| `PORT` | Server port (default: `5000`) |

## Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# API
cd api
pip install -r requirements.txt
flask run
```

## Docker

```bash
# Build and run locally
docker build -t personal-website ./frontend
docker build -t flask-api ./api

docker run -p 3000:3000 personal-website
docker run -p 5000:5000 flask-api
```

## CI/CD

GitHub Actions builds and pushes both Docker images to `ghcr.io` on every push to `master`, tagged with `latest` and the commit SHA.
