# Worker ISNA — notifs live (process long-running de pollers).
# Contexte de build = apps/worker (déployé via `railway up apps/worker --path-as-root`),
# pour ne PAS hériter du railway.json/Dockerfile.full de l'API à la racine du monorepo.
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
# --include=dev pour garder tsx (devDependency) requis au runtime.
RUN npm install --include=dev --legacy-peer-deps --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
# Entrypoint allégé : pipeline notifs live uniquement (cf. src/index.live.ts).
CMD ["npx", "tsx", "src/index.live.ts"]
