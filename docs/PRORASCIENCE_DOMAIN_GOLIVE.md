# Go-live domaine : prorascience.org → tenant isna (sur Vercel)

Objectif : faire servir le tenant **isna** (marque **PRORASCIENCE**) sur **prorascience.org**, consolidé sur le projet **Vercel `app`** qui sert déjà `cimolace.space`.

Le routage front (`apps/app/src/App.jsx`, `CimolaceDomainHandler`) mappe **déjà** :
- `prorascience.org` / `www.prorascience.org` → `/t/isna` (vitrine)
- `isna.prorascience.org` → `/t/isna/admin`

Il restait 3 couches à câbler ; voici l'état + les étapes.

## 1. Base de données (FAIT — fichier à appliquer)
Migration `supabase/migrations/20260603180002_seed_isna_tenant_domains.sql` : insère les lignes `tenant_domains` (custom_host + embed_origin) pour prorascience.org/www/isna.
→ **Appliquer dans le SQL Editor Supabase** (`supabase db push` est cassé sur ce projet).
Effet : `getTenantByHost` résout l'hôte, et la CORS dynamique (`main.ts loadTenantDomains`) autorise l'origine.

## 2. CORS API (FAIT — fichier modifié)
`.env.production` → `CORS_ALLOWED_ORIGINS` inclut maintenant `https://prorascience.org,https://www.prorascience.org`.
→ **Reporter cette valeur dans l'env du service Cloud Run `cimolace-api`** (l'API tourne sur Cloud Run, pas depuis ce fichier) et redéployer/rafraîchir l'env.

## 3. DNS + domaine Vercel (action manuelle)
Sur le projet **Vercel `app`** (`.vercel/project.json` → projectName "app") :
1. Project → **Settings → Domains → Add** : `prorascience.org` **et** `www.prorascience.org`.
2. Vercel affichera les enregistrements DNS à créer chez le registrar de prorascience.org :
   - Apex `prorascience.org` → **A** `76.76.21.21` (IP Vercel) — ou ALIAS/ANAME si le registrar le supporte.
   - `www` → **CNAME** `cname.vercel-dns.com`.
   - (Optionnel) `isna.prorascience.org` → **CNAME** `cname.vercel-dns.com` si l'admin doit être servi sous ce sous-domaine.
3. Les nameservers de prorascience.org sont actuellement en parking (`*.dns-parking.com`) → pointer le DNS chez un fournisseur qui supporte ces enregistrements (ou déléguer à Vercel DNS).
4. Vercel émet le certificat SSL automatiquement une fois le DNS propagé.

> ⚠️ Le projet **Netlify `isna-prorascience-appli`** était précédemment lié à prorascience.org. Pour consolider sur Vercel, **retirer le domaine de Netlify** avant/pendant la bascule DNS pour éviter un conflit de certificat.

## 4. Auth (à ne pas oublier)
Les URLs de redirection Supabase Auth + Google OAuth sont sur `cimolace.space`. Si le login isna se fait sous prorascience.org, **ajouter** dans Supabase (Auth → URL Configuration) et dans la console Google OAuth les URLs de redirection :
- `https://prorascience.org/t/isna/auth/callback`
- `https://prorascience.org/login`, `https://prorascience.org` (Site URL / Redirect allow-list)

## Vérification post-bascule
- `https://prorascience.org` affiche la landing ISNA/Ngowazulu (`/t/isna`).
- `curl https://api.cimolace.space/tenants/by-host/prorascience.org/branding` → 200 (branding isna).
- Pas d'erreur CORS dans la console du navigateur sur prorascience.org.
