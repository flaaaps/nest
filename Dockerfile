# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Builds the web UI and bundles the server into a single JavaScript file.
# Works on linux/amd64, linux/arm64 (Pi 3/4/5 with a 64-bit OS) and linux/arm/v7.
FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable

# Install dependencies first so Docker can cache them between source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY shared ./shared
COPY server ./server
COPY web ./web
RUN pnpm build

# ---- Runtime stage ---------------------------------------------------------
# Only the Node runtime, the bundled server and the static web build are kept.
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    NEST_HOST=0.0.0.0 \
    NEST_PORT=8080 \
    NEST_CONFIG_DIR=/data \
    NEST_STATIC_DIR=/app/web/dist

WORKDIR /app
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
COPY package.json ./

RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${NEST_PORT}/api/health" || exit 1

CMD ["sh", "-c", "NEST_VERSION=$(node -p \"require('./package.json').version\") exec node server/dist/index.js"]
