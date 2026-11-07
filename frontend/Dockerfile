FROM node:22.23.4-alpine3.24 AS builder

WORKDIR /app

# Build context is the repo root so content/ can be shared with the API.
COPY frontend/package*.json ./

# --ignore-scripts skips the `nuxt prepare` postinstall which needs source files
# that haven't been copied yet. `npm run build` runs prepare itself.
# `npm ci` installs exactly package-lock.json, so a rebuild never pulls new library versions.
RUN npm ci --legacy-peer-deps --ignore-scripts

COPY frontend/ ./
# Replace the dev symlink with the real content directory (services, resume, projects)
RUN rm -f ./content
COPY content/ ./content/

RUN npm run build

# Production image
FROM node:22.23.4-alpine3.24 AS runner

WORKDIR /app

# Take Alpine security fixes newer than the base tag and create a non-root user.
# The runtime only needs `node`: strip npm, npx, corepack and yarn (and their bundled deps).
# No curl: the healthcheck uses busybox wget.
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* /root/.npm && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nuxtjs -u 1001

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output /app/.output

# Nitro serves .output/public itself: its asset manifest resolves "../public/<file>" from
# .output/server (globalThis._importMeta_.url is set in .output/server/index.mjs), so no
# symlinks into server/chunks/public are needed. Verified on Nuxt 3.21 and 4.6 by running
# `node .output/server/index.mjs` from a foreign cwd and fetching /favicon.png and /_nuxt/*.

USER nuxtjs

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]