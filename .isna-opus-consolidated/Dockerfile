# ============================================================================
# Dockerfile — ISNA V2 API NestJS
# Cible : Google Cloud Run
# Port : 4000
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Root workspace config
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/tsconfig.build.json apps/api/tsconfig.build.json 2>/dev/null || true
COPY packages/ packages/

RUN npm ci --ignore-scripts

# Source
COPY apps/api/src apps/api/src
COPY apps/api/nest-cli.json apps/api/nest-cli.json 2>/dev/null || true

# Build NestJS → dist/
RUN cd apps/api && npx nest build

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Prod deps only
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/ packages/

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built app
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules 2>/dev/null || true

# Runtime deps
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
