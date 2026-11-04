FROM python:3.11.18-slim-bookworm

WORKDIR /app

# `upgrade` takes Debian security fixes newer than the base tag. No curl: the healthcheck uses Python.
# pip/setuptools/wheel are pin-bumped past the base image's copies (the old setuptools vendors
# vulnerable wheel and jaraco.context).
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir pip==26.3 setuptools==84.2.1 wheel==0.48.0

# Build context is the repo root so services.json can be shared with the frontend.
# requirements.txt is the pinned lockfile (compiled from requirements.in).
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./
# Replace the dev symlink with the real catalog file
COPY services.json ./services.json

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5).read()"]

EXPOSE 5000

# Use gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "app:app"]