FROM node:22-alpine AS builder

WORKDIR /app

# Build context is the repo root so services.json can be shared with the API.
COPY frontend/package*.json ./

# --ignore-scripts skips the `nuxt prepare` postinstall which needs source files
# that haven't been copied yet. `npm run build` runs prepare itself.
RUN npm install --legacy-peer-deps --ignore-scripts

COPY frontend/ ./
# Replace the dev symlink with the real catalog file
COPY services.json ./services.json

RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl and create non-root user
RUN apk add --no-cache curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nuxtjs -u 1001

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output /app/.output

# Create symlinks for Nuxt SSR static assets
# Nuxt server looks for static files in server/chunks/public but they're in public
RUN mkdir -p /app/.output/server/chunks/public && \
    ln -sf /app/.output/public/_nuxt /app/.output/server/chunks/public/_nuxt && \
    if [ -f /app/.output/public/favicon.png ]; then ln -sf /app/.output/public/favicon.png /app/.output/server/chunks/public/favicon.png; fi

USER nuxtjs

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]