# @isna/app — Application connectée (Vite + React)

## Variables d’environnement

À la racine de **`apps/app/`** :

```bash
cp .env.example .env
```

- **`VITE_API_URL`** ou **`VITE_API_V2_URL`** : URL de l’API Nest (ex. `http://localhost:4000`). Les deux sont acceptées ; `VITE_API_URL` prime si les deux sont définies.
- Les clés Supabase (`VITE_SUPABASE_*`) serviront quand le client Auth sera branché ; pour le panneau **Debug API**, tu peux coller manuellement un **access token** JWT.

Ne commite pas `.env`.

## Lancer en dev (monorepo)

Depuis la racine **`isna_platform_v2/`** :

```bash
npm install
npm run dev:app
```

L’URL locale s’affiche dans le terminal (souvent `http://localhost:5173`).  
L’API doit tourner séparément : `npm run dev:api` (port **4000** par défaut).

## Panneau Debug API

La page d’accueil propose **GET /health** et **GET /auth/me** vers l’API configurée, avec gestion chargement / erreur réseau / **401**.
