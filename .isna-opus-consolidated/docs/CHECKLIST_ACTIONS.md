# CHECKLIST DÉPLOIEMENT — À COCHER

**Règle :** Cocher dans l'ordre. Ne rien sauter. Netlify V1 intouchable.

---

## ☐ 1. NETLIFY V1 — SAUVEGARDE

🔗 https://app.netlify.com

```bash
cd /Users/ngowazulu/Downloads/isna_app
npx netlify env:list | tee ~/Desktop/v1-netlify-env-backup.txt
```

> Si erreur : https://app.netlify.com → votre site → Site settings → Environment variables → copier manuellement

---

## ☐ 2. GOOGLE CLOUD — PROJET + BILLING

🔗 https://console.cloud.google.com

- [ ] Créer projet : `cimolace-staging`
- [ ] Activer billing : https://console.cloud.google.com/billing → carte bancaire
- [ ] Lier le projet au compte billing
- [ ] Activer APIs : https://console.cloud.google.com/apis/library

```bash
gcloud auth login
gcloud projects create cimolace-staging --name="Cimolace Staging"
gcloud config set project cimolace-staging
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
gcloud config set run/region europe-west1
```

---

## ☐ 3. SUPABASE — PROJET STAGING

🔗 https://supabase.com/dashboard → **New project**

| Champ | Valeur |
|-------|--------|
| Name | `cimolace-staging` |
| Database Password | Générer → sauvegarder dans un fichier |
| Region | `eu-west-1` (Ireland) |
| Pricing | Free |

Attendre 3 min que la DB soit prête.

- [ ] Copier les 3 clés : https://supabase.com/dashboard/project/xxx/settings/api
  - `SUPABASE_URL` (Project URL)
  - `SUPABASE_SERVICE_ROLE_KEY` (service_role)
  - `SUPABASE_ANON_KEY` (anon public)

- [ ] Exécuter les 26 migrations : https://supabase.com/dashboard/project/xxx/sql/new
  - Ouvrir https://github.com/socubausa-cmd/cimolace-sass/tree/main/supabase/migrations
  - Copier chaque fichier → coller → Run → UN PAR UN

- [ ] Exécuter le seed : https://supabase.com/dashboard/project/xxx/sql/new
  - Ouvrir https://github.com/socubausa-cmd/cimolace-sass/blob/main/supabase/seeds/001_tenants_test.sql
  - Copier → coller → Run

- [ ] Vérifier : Table Editor → `tenants` doit avoir 2 lignes (isna, medos)

---

## ☐ 4. LIVEKIT CLOUD — PROJET STAGING

🔗 https://cloud.livekit.io → **New Project**

| Champ | Valeur |
|-------|--------|
| Name | `cimolace-staging` |
| Region | Même que Supabase |

- [ ] Copier les 3 clés : Settings → Keys
  - `LIVEKIT_URL` (wss://...)
  - `LIVEKIT_API_KEY` (API...)
  - `LIVEKIT_API_SECRET` (secret...)

---

## ☐ 5. VERCEL — LOGIN + CONNECTER REPO

🔗 https://vercel.com

```bash
npm i -g vercel
vercel login
```

- [ ] Importer le repo : https://vercel.com/new
  - Repo : `socubausa-cmd/cimolace-sass`
  - Root Directory : `apps/app`
  - Framework : Vite (auto-détecté)
  - Deploy

- [ ] Deuxième projet : https://vercel.com/new
  - Repo : `socubausa-cmd/cimolace-sass`
  - Root Directory : `apps/public-site`
  - Framework : Next.js (auto-détecté)
  - Deploy

---

## ☐ 6. STRIPE — CLÉS TEST

🔗 https://dashboard.stripe.com

- [ ] Activer **Test Mode** (toggle en haut à droite)
- [ ] Developers → API Keys : https://dashboard.stripe.com/test/apikeys
  - Copier `sk_test_...` (Secret key)

---

## ☐ 7. RESEND — CLÉ API

🔗 https://resend.com/api-keys

- [ ] Créer une nouvelle clé : nom `cimolace-staging`
- [ ] Copier `re_...`

---

## ☐ 8. VARIABLES IA — RÉCUPÉRER

| Service | Dashboard |
|---------|-----------|
| DeepSeek | https://platform.deepseek.com → API Keys |
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic | https://console.anthropic.com → API Keys |

---

## ☐ 9. EXPORTER TOUTES LES VARIABLES

```bash
export SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJh..."
export SUPABASE_ANON_KEY="eyJh..."
export LIVEKIT_URL="wss://..."
export LIVEKIT_API_KEY="API..."
export LIVEKIT_API_SECRET="secret..."
export STRIPE_SECRET_KEY="sk_test_..."
export DEEPSEEK_API_KEY="sk-..."
export RESEND_API_KEY="re_..."
export RESEND_FROM="noreply@staging.cimolace.com"
```

---

## ☐ 10. LANCER LE DÉPLOIEMENT

```bash
cd /Users/ngowazulu/Downloads/isna_platform_v2/.isna-opus-consolidated
bash scripts/deploy-all-staging.sh
```

---

## ☐ 11. VÉRIFIER

```bash
curl https://api.staging.cimolace.com/health
# → {"status":"ok"}

curl -H "X-Tenant-Slug: isna" https://api.staging.cimolace.com/tenants/current
# → 401 (normal, pas encore de JWT)

# Navigateur :
open https://app.staging.cimolace.com
open https://staging.cimolace.com
```

---

```
☐ 1. Netlify V1  — backup variables
☐ 2. Google Cloud — projet + billing + APIs
☐ 3. Supabase    — projet + 26 migrations + seed
☐ 4. LiveKit     — projet staging
☐ 5. Vercel      — login + 2 projets
☐ 6. Stripe      — sk_test_...
☐ 7. Resend      — re_...
☐ 8. IA          — DeepSeek + OpenAI + Anthropic
☐ 9. Export      — toutes les variables dans le shell
☐ 10. Deploy     — bash scripts/deploy-all-staging.sh
☐ 11. Vérifier   — curl /health
```
