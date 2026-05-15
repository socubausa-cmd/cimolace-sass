# ============================================================================
# Dockerfile — ISNA V2 API NestJS
# Cible : Google Cloud Run — Port 4000
# Stratégie : build apps/api/ uniquement (pas de dépendances workspace)
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copier uniquement le package.json de l'API (pas le monorepo)
COPY apps/api/package.json ./

# Installer TOUT (dev inclus → besoin de @nestjs/cli, typescript pour build)
RUN npm install --legacy-peer-deps --ignore-scripts

# Copier le source et la config TypeScript
COPY apps/api/tsconfig.json ./
COPY apps/api/tsconfig.build.json ./
COPY apps/api/nest-cli.json ./
COPY apps/api/src ./src

# Build NestJS → dist/
RUN npx nest build

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copier package.json et installer dépendances PROD uniquement
COPY apps/api/package.json ./
RUN npm install --omit=dev --legacy-peer-deps --ignore-scripts && npm cache clean --force

# Copier le build depuis le stage 1
COPY --from=builder /app/dist ./dist

RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
