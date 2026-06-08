# Cimolace sur Vercel — domaine `cimolace.space`

Date: 2026-05-26

## Decision

Cimolace, le SaaS central, doit etre heberge sur Vercel avec le domaine:

- Frontend: `https://cimolace.space`
- API recommandee: `https://api.cimolace.space`

Ne pas utiliser le projet Netlify `isna-prorascience-appli` pour Cimolace. Ce projet est lie a `https://prorascience.org` et correspond au tenant ISNA/Prorascience.

## Projet Vercel

Le repo contient deja une app Vite deployable:

- Dossier: `apps/app`
- Config: `apps/app/vercel.json`
- Config racine de deploiement monorepo: `vercel.json`
- Build: `npm run build`
- Output: `dist`
- Rewrites SPA: `/(.*)` vers `/index.html`

Les dossiers locaux `apps/app/.vercel/project.json` et `.vercel/project.json` pointent vers le projet Vercel `cimolace/app`.

## Variables production

Creer le fichier local:

```bash
cp .env.production.example .env.production
```

Remplir au minimum:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `API_URL=https://api.cimolace.space`
- `APP_URL=https://cimolace.space`
- `FRONTEND_URL=https://cimolace.space`
- `CORS_ALLOWED_ORIGINS=https://cimolace.space,https://www.cimolace.space`

Etat initial observe le 2026-05-26:

- Les fichiers locaux `apps/app/.env` et `apps/api/.env` correspondent au developpement/local et au tenant modele ISNA/Prorascience. Ne pas les pousser tels quels en production Cimolace.
- Avant un nouveau deploiement production, creer une configuration production Cimolace separee, puis ajouter les variables dans Vercel.

Etat final du 2026-05-26:

- Variables frontend production ajoutees dans Vercel:
  - `VITE_API_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_LIVEKIT_URL`
  - `VITE_APP_ENV`
  - `VITE_APP_NAME`
  - `VITE_SUPABASE_LIVE_RECORDINGS_BUCKET`
- Secrets backend non ajoutes au frontend Vercel.
- `VITE_API_URL` pointe vers `https://api.cimolace.space`.

## Deploiement frontend Vercel

Connexion CLI:

```bash
cd apps/app
vercel login
```

Depuis la racine:

```bash
vercel --prod --scope cimolace --yes
```

Le projet utilise la configuration racine `vercel.json` pour deploiement monorepo:

- `installCommand`: `npm install --legacy-peer-deps && npm install @rollup/rollup-linux-x64-gnu@4.60.3 --no-save --legacy-peer-deps`
- `buildCommand`: `npm run build -w @isna/app`
- `outputDirectory`: `apps/app/dist`

## Connexion du domaine

Dans Vercel:

1. Ouvrir le projet Cimolace (`apps/app`).
2. Aller dans Settings -> Domains.
3. Ajouter `cimolace.space`.
4. Ajouter aussi `www.cimolace.space` si souhaite.
5. Suivre les enregistrements DNS proposes par Vercel.

DNS attendu selon Vercel:

- apex `cimolace.space`: `A cimolace.space 76.76.21.21`.
- `www.cimolace.space`: `A www.cimolace.space 76.76.21.21`.

Etat observe le 2026-05-26:

- Vercel a bien ajoute le domaine au projet `app`.
- Nouveau deploiement production pret: `app-3o0o9brag-cimolace.vercel.app`.
- Les aliases `cimolace.space` et `www.cimolace.space` pointent vers `app-3o0o9brag-cimolace.vercel.app`.
- Le DNS public pointe vers `76.76.21.21`.
- Les nameservers publics sont encore `aster.dns-parking.com` et `helios.dns-parking.com`.
- La protection SSO Vercel a ete desactivee pour le projet `app`.
- `https://cimolace.space`, `https://www.cimolace.space` et `https://cimolace.space/cimolace/login` repondent en HTTP 200 via Vercel.
- Les records DNS ont ete crees dans la zone Vercel:
  - `rec_b3f2a9f5bf9a02054e2dd5e5`: `A cimolace.space 76.76.21.21`
  - `rec_3cfec1c05d378e8c7b8e5cb2`: `A www.cimolace.space 76.76.21.21`
- Ces records ne deviennent publics que si le registrar utilise les nameservers Vercel.

Alternative possible: remplacer les nameservers du registrar par ceux de Vercel:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## API

Le frontend Vercel ne marchera pas en production si l'API reste en localhost.

Deux options:

1. Recommandee: deployer l'API Nest sur Cloud Run et connecter `api.cimolace.space`.
2. Alternative: migrer l'API vers une cible Vercel compatible serverless, non configuree actuellement.

Etat final du 2026-05-26:

- API deployee sur Cloud Run:
  - Service: `cimolace-api`
  - Revision active: `cimolace-api-00003-7hz`
  - URL: `https://cimolace-api-4akcrtlula-ew.a.run.app`
  - Health: `https://cimolace-api-4akcrtlula-ew.a.run.app/health`
- `GET /health` repond `{"status":"ok", ...}`.
- CORS valide depuis `https://cimolace.space`.
- `api.cimolace.space` est mappe sur Cloud Run.
- DNS requis et publie chez Hostinger:
  - `CNAME api ghs.googlehosted.com`
- Certificat Google emis et valide pour `api.cimolace.space`.
- `GET https://api.cimolace.space/health` repond `{"status":"ok", ...}`.
- CORS valide depuis `https://cimolace.space` avec `access-control-allow-origin: https://cimolace.space`.
- Le frontend Vercel a ete redeploye apres remplacement de `VITE_API_URL` par `https://api.cimolace.space`.

## Supabase Auth

Dans Supabase Auth, mettre a jour:

- Site URL: `https://cimolace.space`
- Redirect URLs:
  - `https://cimolace.space/auth/callback`
  - `https://cimolace.space/cimolace/auth/callback`
  - `https://www.cimolace.space/auth/callback`
  - `https://www.cimolace.space/cimolace/auth/callback`

## Verification

Apres propagation DNS:

```bash
curl -I https://cimolace.space
curl https://api.cimolace.space/health
```

Puis ouvrir:

- `https://cimolace.space/cimolace/login`
- `https://cimolace.space/cimolace/admin`

Le login doit appeler `https://api.cimolace.space`, pas `localhost`.
