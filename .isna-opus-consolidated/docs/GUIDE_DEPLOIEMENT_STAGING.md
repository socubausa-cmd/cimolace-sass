# GUIDE DE DÉPLOIEMENT STAGING — MedOS/Cimolace V2

**Objectif :** Passer de "code sur GitHub" à "staging public fonctionnel"
**Durée estimée :** 45 minutes
**Prérequis :** Accès GitHub, carte bancaire pour Supabase/Vercel

---

## ÉTAPE 1 — Créer les comptes services (10 min)

Ouvre ces 6 onglets et crée les comptes :

| # | Service | URL | Compte à créer | Gratuit ? |
|---|---------|-----|---------------|-----------|
| 1 | **Supabase** | https://supabase.com | Nouveau projet "cimolace-staging" | Oui (500 MB) |
| 2 | **LiveKit Cloud** | https://cloud.livekit.io | Nouveau projet "cimolace-staging" | Oui (50 GB/mois) |
| 3 | **Stripe** | https://dashboard.stripe.com | Mode TEST (pas besoin d'activer) | Oui |
| 4 | **Resend** | https://resend.com | Compte + domaine ou `noreply@staging.cimolace.com` | Oui (100 emails/jour) |
| 5 | **GitHub Secrets** | Votre repo → Settings → Secrets and variables → Actions | Ajouter les secrets (voir Étape 2) | — |
| 6 | **Vercel** | https://vercel.com | Compte gratuit (optionnel — déploiement Cloud Run alternatif) | Oui |

> ⚠️ Tu n'as PAS besoin de compte Google Cloud pour le staging. Vercel + Supabase suffisent.

---

## ÉTAPE 2 — Ajouter les secrets GitHub (5 min)

Dans **GitHub → Repo → Settings → Secrets and variables → Actions → New repository secret**,
ajoute CES EXACTEMENT 12 secrets (les noms doivent correspondre au workflow CI) :

| # | Nom du secret | Où trouver la valeur |
|---|--------------|---------------------|
| 1 | `SUPABASE_URL_STAGING` | Dashboard Supabase → Settings → API → Project URL |
| 2 | `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Dashboard Supabase → Settings → API → `service_role` (commence par `eyJh...`) |
| 3 | `SUPABASE_ANON_KEY_STAGING` | Dashboard Supabase → Settings → API → `anon` key |
| 4 | `LIVEKIT_URL` | Dashboard LiveKit → Settings → Websocket URL (`wss://...`) |
| 5 | `LIVEKIT_API_KEY` | Dashboard LiveKit → Settings → API Key |
| 6 | `LIVEKIT_API_SECRET` | Dashboard LiveKit → Settings → API Secret |
| 7 | `STRIPE_SECRET_KEY` | Dashboard Stripe → Developers → API Keys → `sk_test_...` |
| 8 | `STRIPE_BILLING_WEBHOOK_SECRET` | Dashboard Stripe → Developers → Webhooks → Create endpoint → Signing secret (`whsec_...`) |
| 9 | `DEEPSEEK_API_KEY` | https://platform.deepseek.com → API Keys |
| 10 | `RESEND_API_KEY` | Dashboard Resend → API Keys → `re_...` |
| 11 | `RESEND_FROM` | `noreply@staging.cimolace.com` (ou ton domaine vérifié) |

> Les clés Chariow, CinetPay, Anthropic, OpenAI sont optionnelles en staging.

---

## ÉTAPE 3 — Appliquer les migrations SQL sur Supabase (10 min)

Dans **Dashboard Supabase → SQL Editor → New query**, exécute CES 7 fichiers
**DANS CET ORDRE EXACT** :

### Migration 1
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20250505_001_tenants.sql
```

### Migration 2
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20250505_002_access_passes.sql
```

### Migration 3
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20250505_003_live_sessions.sql
```

### Migration 4
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20250505000004_marketing.sql
```

### Migration 5
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20260514_001_liri_studio_workspaces.sql
```

### Migration 6
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20260514_002_billing_multi_provider.sql
```

### Migration 7
```sql
-- Copier-coller le contenu de :
-- supabase/migrations/20260514_003_missing_tables.sql
```

> Après chaque migration, vérifie dans **Table Editor** que les tables apparaissent.

---

## ÉTAPE 4 — Exécuter le seed des 2 tenants test (2 min)

Dans **Dashboard Supabase → SQL Editor → New query** :

```sql
-- Copier-coller le contenu de :
-- supabase/seeds/001_tenants_test.sql
```

Vérifie dans **Table Editor** :
- `tenants` doit avoir 2 lignes : `isna` et `medos`
- `liri_course_workspaces` doit avoir 2 lignes (une par tenant)
- `live_sessions` doit avoir 2 lignes (une par tenant)

---

## ÉTAPE 5 — Déployer l'API sur Vercel (5 min)

```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Se connecter
vercel login

# 3. Déployer l'API
cd .isna-opus-consolidated
vercel --prod

# 4. Configurer les variables d'environnement dans Vercel
# Dashboard Vercel → Settings → Environment Variables
# Ajouter les mêmes 11 variables que dans GitHub Secrets
```

**Alternative Google Cloud Run :**
```bash
gcloud run deploy isna-api \
  --source . \
  --region europe-west1 \
  --set-env-vars "SUPABASE_URL_STAGING=...,LIVEKIT_URL=...,..."
```

---

## ÉTAPE 6 — Déployer le frontend sur Vercel (3 min)

```bash
cd apps/app
vercel --prod
```

```bash
cd apps/public-site
vercel --prod
```

---

## ÉTAPE 7 — Vérifier le déploiement (5 min)

### 7.1 Health check

```bash
curl https://TON-URL-STAGING.vercel.app/health
# Attendu : {"status":"ok","uptime":...}
```

### 7.2 Tenant A (ISNA)

```bash
# Créer un utilisateur sur Supabase Auth
# Puis obtenir un token JWT via Supabase login

curl -X GET "https://TON-URL-STAGING.vercel.app/tenants/current" \
  -H "Authorization: Bearer JWT_USER_A_OWNER" \
  -H "X-Tenant-Slug: isna"

# Attendu : {"data":{"id":"a0000000-...","slug":"isna","name":"Institut ISNA","userRole":"owner"}}
```

### 7.3 Tenant B (MedOS)

```bash
curl -X GET "https://TON-URL-STAGING.vercel.app/tenants/current" \
  -H "Authorization: Bearer JWT_USER_B_OWNER" \
  -H "X-Tenant-Slug: medos"

# Attendu : {"data":{"id":"b0000000-...","slug":"medos","name":"Clinique MedOS","userRole":"owner"}}
```

### 7.4 Isolation — Tenant B ne voit PAS les données de Tenant A

```bash
# Utiliser le token de Tenant B, mais forcer X-Tenant-Slug = isna
curl -X GET "https://TON-URL-STAGING.vercel.app/studio/workspaces" \
  -H "Authorization: Bearer JWT_USER_B_OWNER" \
  -H "X-Tenant-Slug: isna"

# Attendu : 403 Forbidden — "Accès refusé à ce tenant"
```

### 7.5 Workspaces isolés

```bash
# Tenant A voit SES workspaces
curl -X GET "https://TON-URL-STAGING.vercel.app/studio/workspaces" \
  -H "Authorization: Bearer JWT_USER_A_OWNER" \
  -H "X-Tenant-Slug: isna"
# Contient : "Cours ISNA — Nutrition"
# Ne contient PAS : "Cours MedOS — Anatomie"

# Tenant B voit SES workspaces
curl -X GET "https://TON-URL-STAGING.vercel.app/studio/workspaces" \
  -H "Authorization: Bearer JWT_USER_B_OWNER" \
  -H "X-Tenant-Slug: medos"
# Contient : "Cours MedOS — Anatomie"
# Ne contient PAS : "Cours ISNA — Nutrition"
```

---

## CHECKLIST DE VALIDATION

| # | Test | Résultat |
|---|------|----------|
| 1 | Supabase Staging créé | ☐ OK / ☐ PAS OK |
| 2 | 7 migrations appliquées | ☐ OK / ☐ PAS OK |
| 3 | Seed 2 tenants exécuté | ☐ OK / ☐ PAS OK |
| 4 | GitHub Secrets configurés | ☐ OK / ☐ PAS OK |
| 5 | CI GitHub Actions passe | ☐ OK / ☐ PAS OK |
| 6 | API déployée sur Vercel/Cloud Run | ☐ OK / ☐ PAS OK |
| 7 | `GET /health` → 200 | ☐ OK / ☐ PAS OK |
| 8 | `GET /tenants/current` (isna) → 200 | ☐ OK / ☐ PAS OK |
| 9 | `GET /tenants/current` (medos) → 200 | ☐ OK / ☐ PAS OK |
| 10 | Tenant B → isna → 403 | ☐ OK / ☐ PAS OK |
| 11 | Workspaces A ≠ Workspaces B | ☐ OK / ☐ PAS OK |
| 12 | Frontend app accessible | ☐ OK / ☐ PAS OK |
| 13 | Frontend public accessible | ☐ OK / ☐ PAS OK |
| 14 | `npm test` passe en local | ☐ OK / ☐ PAS OK |

### Staging validé si : 14/14 OK

---

## URLs cibles (après déploiement)

| Service | URL |
|---------|-----|
| **API** | `https://api-staging-cimolace.vercel.app` (ou ton domaine) |
| **App** | `https://app-staging-cimolace.vercel.app` |
| **Public** | `https://staging-cimolace.vercel.app` |
| **Health** | `https://api-staging-cimolace.vercel.app/health` |

---

## En cas d'erreur

| Erreur | Solution |
|--------|----------|
| `EADDRINUSE` | `killall node` puis relancer |
| `401 Unauthorized` | Vérifier le JWT Bearer token |
| `400 X-Tenant-Slug requis` | Ajouter le header `X-Tenant-Slug: isna` |
| `403 Accès refusé` | Comportement normal si cross-tenant |
| `404 Tenant introuvable` | Vérifier que le seed a été exécuté |
| `relation "xxx" does not exist` | Migration manquante — ré-exécuter dans l'ordre |

---

*Guide généré le 2026-05-14. Commit : `4a989890`*
