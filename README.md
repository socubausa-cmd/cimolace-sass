# ISNA / LIRI / CIMOLACE Platform V2

Plateforme V2 indépendante contrôlée.

## Objectif

Construire une nouvelle infrastructure SaaS live/vidéo premium sans casser la V1 existante.

## Structure

```txt
apps/
  public-site/   Site public SEO en Next.js
  app/           Application connectée React + Vite
  api/           Backend métier NestJS/Fastify
  worker/        Jobs vidéo, IA, emails, notifications
packages/
  ui/            Composants partagés
  types/         Types partagés
  config/        Configuration partagée
docs/            Architecture, roadmap, décisions
```

## Développement (monorepo)

À la racine de `isna_platform_v2`, après `npm install` :

```bash
npm run dev:api           # NestJS → http://localhost:4000 (GET /health)
npm run dev:app           # Vite (port selon affichage terminal)
npm run dev:public-site   # Next.js → http://localhost:3000 par défaut
npm run dev:worker        # Worker ping
```

Build de tout ce qui expose un script `build` :

```bash
npm run build
```

## Principe

La V1 reste la référence fonctionnelle. La V2 est isolée, avec ses propres variables, son propre Supabase dev/staging et sa propre infrastructure.
