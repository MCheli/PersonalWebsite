# Deploying markcheli.com

Two containers on the 83RR PowerEdge (Ubuntu, Docker Compose, NGINX, Cloudflare in front), defined in [MCheli/83rr-poweredge](https://github.com/MCheli/83rr-poweredge) `docker-compose.yml`. Nothing is deployed by hand.

## The path

1. Push to `master` (a merged PR). `.github/workflows/docker-publish.yml` runs the `test` job (the `make pre-commit` list).
2. `build-frontend` and `build-api` build the images from the repo root (so `content/` is copied into both) and push to `ghcr.io/mcheli/personal-website` and `ghcr.io/mcheli/flask-api`, tagged `latest` and the commit SHA.
3. Watchtower on the R630 polls every 5 minutes (`WATCHTOWER_LABEL_ENABLE=true`; both containers carry `com.centurylinklabs.watchtower.enable=true`), pulls `:latest`, recreates the container, and removes the old image (`WATCHTOWER_CLEANUP=true`).

Rough time from merge to live: 5 to 10 minutes. `docker logs watchtower` on the server shows the pull.

PRs build both images without pushing and smoke-test them (healthy, slim, static assets and content endpoints served). Fridays 08:00 UTC the images rebuild on freshly pulled base images so OS fixes land without a code change.

## What runs

| Container | Image | Environment | Health |
|---|---|---|---|
| `personal-website` | `ghcr.io/mcheli/personal-website:latest` | `NODE_ENV=production`, `NUXT_PUBLIC_API_BASE=/api`, `API_URL=http://flask-api:5000` | `wget --spider http://127.0.0.1:3000/` |
| `flask-api` | `ghcr.io/mcheli/flask-api:latest` | `FLASK_ENV=production`, `OPENWEATHER_API_KEY` and `NTFY_PUBLISH_TOKEN` (plus optional `NTFY_URL`, `NTFY_TOPIC`) from the server's `.env` | `GET /health` |

Both sit on the `infrastructure` network with no published ports. NGINX (`infrastructure/nginx/conf.d/production.conf` in the homelab repo) proxies `www.markcheli.com` to `personal-website:3000` and `flask.markcheli.com` to `flask-api:5000`; `markcheli.com` redirects to `www`. Cloudflare terminates TLS at the edge with origin certificates on NGINX.

Note on the API URL: NGINX routes `www.markcheli.com/api/` to `flask-api` (83rr-poweredge #31), so the site can call `/api/contact` same-origin; `https://flask.markcheli.com` still works directly. `API_URL` only matters to the Nuxt dev proxy.

Images run as non-root (`nuxtjs` / `appuser`), carry no curl or npm, and copy `content/` in place of the dev symlink. The frontend image serves `.output/public` through Nitro itself.

## Rolling back

Every push also tags the images with the commit SHA. To roll back, point the server at a known-good SHA instead of `latest`:

```bash
cd ~/83rr-poweredge
# 1. find the SHA (GitHub: Actions run, or `git log` in this repo)
# 2. pin it in docker-compose.yml
sed -i 's|ghcr.io/mcheli/personal-website:latest|ghcr.io/mcheli/personal-website:<sha>|' docker-compose.yml
docker compose pull personal-website && docker compose up -d --no-deps personal-website
```

Watchtower only follows the tag a container was started with, so a SHA-pinned container stays put until you switch it back to `:latest` (edit, `pull`, `up -d --no-deps`) once master is fixed. Same recipe for `flask-api`. Commit the compose change in the homelab repo so the pin is visible.

Alternatively retag on the registry: `docker pull ghcr.io/mcheli/personal-website:<sha> && docker tag ... :latest && docker push ...` from a machine logged in to ghcr.io; Watchtower deploys it on its next poll.

## After a deploy

```bash
curl -fsS https://www.markcheli.com/ | grep -o '<title>[^<]*'
curl -fsS https://flask.markcheli.com/health
curl -fsS https://flask.markcheli.com/resume | head -c 200
```

The Monday `catalog-drift` CI job then keeps checking that `content/services.json` still matches the compose file and that the public URLs answer.
