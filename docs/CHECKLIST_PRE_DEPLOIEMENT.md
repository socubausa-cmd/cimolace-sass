# CHECKLIST PRÉ-DÉPLOIEMENT — ISNA V2 Staging

**Objectif :** Avoir TOUT prêt avant de lancer le moindre `gcloud deploy` ou `vercel`.
**Règle d'or :** Ne jamais supprimer, modifier ou débrancher Netlify V1. Le staging V2 est un environnement parallèle.

---

## ⚠️ AVANT TOUT — SAUVEGARDE VARIABLES V1

```bash
cd /Users/ngowazulu/Downloads/isna_app

# Exporter toutes les variables Netlify V1
npx netlify env:list 2>&1 | tee ~/Desktop/v1-netlify-env-backup.txt

# Si la CLI Netlify échoue, utiliser l'API :
# curl -H "Authorization: Bearer <NETLIFY_TOKEN>" \
#   "https://api.netlify.com/api/v1/sites/<SITE_ID>/env-vars" | tee ~/Desktop/v1-netlify-env-backup.json
```

> ✅ Cette sauvegarde est ta police d'assurance. Garde `~/Desktop/v1-netlify-env-backup.txt`.

---

## 1. COMPTE GOOGLE CLOUD

### 1.1 Ce dont tu as besoin

| Élément | Valeur |
|---------|--------|
| **Projet à créer** | `cimolace-staging` |
| **Billing requis ?** | OUI — Google Cloud Run exige un compte billing actif (même pour le free tier) |
| **Carte bancaire** | Oui, pour activer le billing. Coût estimé : **0-15€/mois** |
| **Région recommandée** | `europe-west1` (Belgique) — ou `europe-west9` (Paris) |
| **APIs à activer** | `cloudbuild.googleapis.com`, `run.googleapis.com`, `containerregistry.googleapis.com` |

### 1.2 Commandes exactes (dans l'ordre)

```bash
# Étape 1 : Installer gcloud CLI
brew install google-cloud-sdk
# ou : https://cloud.google.com/sdk/docs/install

# Étape 2 : Se connecter
gcloud auth login
# → Ouvre le navigateur → choisir le compte Google → autoriser

# Étape 3 : Créer le projet
gcloud projects create cimolace-staging --name="Cimolace Staging"
# → Noter le PROJECT_ID affiché (ex: cimolace-staging-123456)

# Étape 4 : Activer le billing
# Ouvre https://console.cloud.google.com/billing
# → Créer un compte billing (carte bancaire requise)
# → Lier le projet cimolace-staging à ce compte billing

# Étape 5 : Sélectionner le projet
gcloud config set project cimolace-staging

# Étape 6 : Activer les APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# Étape 7 : Configurer la région
gcloud config set run/region europe-west1
```

### 1.3 Vérification

```bash
gcloud config list
# Doit afficher :
#   project = cimolace-staging
#   region = europe-west1
```

---

## 2. COMPTE SUPABASE

### 2.1 Ce dont tu as besoin

| Élément | Action |
|---------|--------|
| **Projet V1** | Ne PAS toucher. Rester connecté pour référence. |
| **Projet V2 Staging** | Créer un NOUVEAU projet `cimolace-staging` |
| **Region** | Même région que Google Cloud (`eu-west-1` pour europe-west1) |
| **Plan** | Free (500 MB) |

### 2.2 Étapes Supabase

```
1. Aller sur https://supabase.com
2. Cliquer "New project"
3. Nom : cimolace-staging
4. Organisation : choisir la même que V1
5. Database Password : générer un mot de passe fort → SAUVEGARDER
6. Region : eu-west-1 (ou même que le projet V1)
7. Pricing : Free
8. Attendre 2-3 minutes que la DB soit prête
```

### 2.3 Credentials à récupérer

Dashboard → Settings → API → copier CES 3 valeurs :

```bash
# Sauvegarde dans un fichier sécurisé
SUPABASE_URL_STAGING="https://xxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY_STAGING="eyJh..."
SUPABASE_ANON_KEY_STAGING="eyJh..."
```

### 2.4 Exécuter les migrations

Dans Dashboard Supabase → SQL Editor → **New query** → exécuter dans cet ORDRE :

```sql
-- Copier-coller chaque fichier depuis GitHub, UN PAR UN, dans l'ordre :
-- https://github.com/socubausa-cmd/cimolace-sass/tree/main/supabase/migrations
-- 
-- 01. 20250505000001_tenants.sql
-- 02. 20250505000002_access_passes.sql
-- 03. 20250505000003_live_sessions.sql
-- 04. 20250505000004_marketing.sql
-- 05. 20250505000005_billing.sql
-- 06. 20250510000006_cimolace_catalog.sql
-- 07. 20250512000006_live_participants.sql
-- 08. 20250512000007_live_recordings.sql
-- 09. 20260510000007_medos_core.sql
-- 10. 20260510000008_medos_forms_health.sql
-- 11. 20260511000009_medos_note_reads.sql
-- 12. 20260512000010_smartboard.sql
-- 13. 20260513000013_stripe_connect.sql
-- 14. 20260513000014_billing_rls.sql
-- 15. 20260513000015_liri_conversations.sql
-- 16. 20260513000016_booking.sql
-- 17. 20260513000017_pawapay_deposits.sql
-- 18. 20260513000018_forum.sql
-- 19. 20260513000019_notifications.sql
-- 20. 20260513000020_email_engine.sql
-- 21. 20260513000021_sms_engine.sql
-- 22. 20260513000022_ai_video.sql
-- 23. 20260513000023_billing_v2.sql
-- 24. 20260514_001_liri_studio_workspaces.sql
-- 25. 20260514_002_billing_multi_provider.sql
-- 26. 20260514_003_missing_tables.sql
```

> ⚠️ 26 fichiers à exécuter UN PAR UN. Ne pas les fusionner dans une seule requête.
> 💡 Ouvre chaque fichier sur GitHub, copie le contenu, colle dans SQL Editor, Run.

### 2.5 Exécuter le seed

```sql
-- Fichier : supabase/seeds/001_tenants_test.sql
-- Crée 2 tenants (ISNA + MedOS) avec workspaces et live sessions
```

### 2.6 Vérification

Dans Dashboard → Table Editor :
- `tenants` : 2 lignes (isna, medos)
- `liri_course_workspaces` : 2 lignes
- `live_sessions` : 2 lignes

---

## 3. COMPTE LIVEKIT CLOUD

### 3.1 Ce dont tu as besoin

| Élément | Action |
|---------|--------|
| **Projet V1** | Ne PAS toucher |
| **Projet V2 Staging** | Créer un NOUVEAU projet `cimolace-staging` |

### 3.2 Étapes

```
1. Aller sur https://cloud.livekit.io
2. Cliquer "New Project"
3. Nom : cimolace-staging
4. Region : même que Supabase V2
```

### 3.3 Credentials à récupérer

```bash
LIVEKIT_URL="wss://cimolace-staging-xxxxx.livekit.cloud"
LIVEKIT_API_KEY="APIxxxxxxxx"
LIVEKIT_API_SECRET="secretxxxxxxxx"
```

---

## 4. COMPTE VERCEL

### 4.1 Ce dont tu as besoin

| Élément | Valeur |
|---------|--------|
| **Projets à créer** | 2 : `cimolace-app-staging` + `cimolace-public-staging` |
| **Repo à connecter** | `socubausa-cmd/cimolace-sass` |
| **Framework** | Auto-détecté par `vercel.json` |

### 4.2 Commandes

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer l'app (crée le projet automatiquement)
cd /Users/ngowazulu/Downloads/isna_platform_v2/apps/app
vercel --prod
# → Accepter les défauts → le projet est créé

cd /Users/ngowazulu/Downloads/isna_platform_v2/apps/public-site
vercel --prod
# → Accepter les défauts → le projet est créé
```

### 4.3 Variables à configurer dans Vercel

Dashboard Vercel → chaque projet → Settings → Environment Variables :

**Projet App React/Vite :**
```
VITE_API_URL = https://api.staging.cimolace.com
VITE_SUPABASE_URL = https://xxxxxxxxxxxx.supabase.co   (même que SUPABASE_URL_STAGING)
VITE_SUPABASE_ANON_KEY = eyJh...                        (même que SUPABASE_ANON_KEY_STAGING)
VITE_LIVEKIT_URL = wss://cimolace-staging-xxxxx.livekit.cloud
```

**Projet Public Site Next.js :**
```
NEXT_PUBLIC_API_URL = https://api.staging.cimolace.com
NEXT_PUBLIC_SUPABASE_URL = https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJh...
```

---

## 5. COMPTE STRIPE (MODE TEST)

### 5.1 Récupérer les clés

```
1. Aller sur https://dashboard.stripe.com
2. Activer Test Mode (toggle en haut à droite)
3. Developers → API Keys → copier sk_test_...
```

```bash
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxx"
```

### 5.2 Webhook secret (à générer APRÈS le déploiement API)

```bash
# Après que l'API soit déployée, générer le secret webhook
stripe listen --forward-to https://api.staging.cimolace.com/billing/webhook/stripe
# → Copier le whsec_... affiché
```

---

## 6. AUTRES VARIABLES À AVOIR SOUS LA MAIN

```bash
# Clés IA (réutiliser V1)
DEEPSEEK_API_KEY="sk-..."          # platform.deepseek.com
ANTHROPIC_API_KEY="sk-ant-..."     # Optionnel
OPENAI_API_KEY="sk-..."            # Optionnel

# Email
RESEND_API_KEY="re_..."            # resend.com → nouvelle clé
RESEND_FROM="noreply@staging.cimolace.com"

# Paiements Afrique (optionnel en staging)
CHARIOW_API_KEY="..."
CINETPAY_API_KEY="..."
CINETPAY_SITE_ID="..."
```

---

## 7. NETLIFY V1 — NE PAS TOUCHER

| Élément | Statut |
|---------|--------|
| **Variables Netlify** | ✅ Sauvegardées (étape 0) |
| **Webhooks Stripe** | → Pointent VERS Netlify V1 — NE PAS MODIFIER |
| **Webhooks Chariow** | → Pointent VERS Netlify V1 — NE PAS MODIFIER |
| **Webhooks CinetPay** | → Pointent VERS Netlify V1 — NE PAS MODIFIER |
| **Webhooks LiveKit** | → Pointent VERS Netlify V1 — NE PAS MODIFIER |
| **Domaines DNS** | → Pointent VERS Netlify V1 — NE PAS MODIFIER |
| **Déploiement Netlify** | → NE PAS désactiver |

> ⚠️ Les webhooks Stripe/Chariow/CinetPay/LiveKit DOIVENT CONTINUER à pointer vers Netlify V1.
> La V2 aura ses propres endpoints webhook, mais ils seront testés séparément.
> **Aucun basculement de webhook avant validation complète (42/42 checklist).**

---

## 8. COMMANDES EXACTES DANS L'ORDRE

### Séquence de déploiement

```bash
# ── 0. Prérequis une seule fois ─────────────────────────────────────────
gcloud auth login
gcloud config set project cimolace-staging
gcloud auth configure-docker

vercel login

# ── 1. Déployer l'API Cloud Run ─────────────────────────────────────────
#    (vérifier que SUPABASE_URL_STAGING est exporté en variable d'env locale)
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

cd /Users/ngowazulu/Downloads/isna_platform_v2
bash scripts/deploy-api-cloudrun.sh

# ── 2. Déployer l'App React/Vite ────────────────────────────────────────
bash scripts/deploy-app-vercel.sh

# ── 3. Déployer le Public Site Next.js ───────────────────────────────────
bash scripts/deploy-public-vercel.sh

# ── 4. Vérifier ─────────────────────────────────────────────────────────
curl https://api.staging.cimolace.com/health
# → {"status":"ok"}

curl -H "X-Tenant-Slug: isna" https://api.staging.cimolace.com/tenants/current
# → 401 (normal, pas de JWT)

# Navigateur :
# https://app.staging.cimolace.com
# https://staging.cimolace.com
```

---

## 9. POINTS DE BLOCAGE POSSIBLES

| # | Blocage | Solution |
|---|---------|----------|
| 1 | **Billing Google Cloud** | Carte bancaire obligatoire. Gratuit jusqu'à 2M requêtes/mois. Pas débité. |
| 2 | **gcloud permission denied** | Vérifier : `gcloud auth list` → compte actif. Relancer `gcloud auth login`. |
| 3 | **Docker non installé** | `brew install docker` + lancer Docker Desktop |
| 4 | **Build Cloud Run échoue** | Vérifier : `cd apps/api && npx tsc --noEmit -p tsconfig.json` en local |
| 5 | **Vercel "project not found"** | Créer le projet via `vercel` en mode interactif d'abord |
| 6 | **Variables manquantes** | Refaire l'export des variables avant `deploy-api-cloudrun.sh` |
| 7 | **Domaine staging déjà utilisé** | Vercel attribue un domaine `.vercel.app` automatiquement. Le domaine custom `staging.cimolace.com` est optionnel. |
| 8 | **Supabase migration error** | Exécuter les migrations UNE PAR UNE, pas toutes ensemble |
| 9 | **CORS error frontend → API** | Vérifier que l'API a `app.enableCors()` et que `VITE_API_URL` est correct |
| 10 | **Netlify V1 cassé par erreur** | Si tu as touché à Netlify par erreur : redéployer le dernier commit Netlify. Les variables sont sauvegardées. |

---

## RÉSUMÉ — CE QUE TU DOIS AVOIR SOUS LA MAIN

```
☐ Sauvegarde variables Netlify V1 (fichier Desktop)
☐ Compte Google Cloud avec billing activé
☐ Projet gcloud "cimolace-staging" créé
☐ APIs Cloud Build + Cloud Run activées
☐ Projet Supabase "cimolace-staging" créé
☐ 26 migrations SQL exécutées sur Supabase Staging
☐ Seed 2 tenants exécuté
☐ Projet LiveKit Cloud "cimolace-staging" créé
☐ Vercel CLI installé + login
☐ Stripe TEST mode activé, sk_test_... copiée
☐ Resend nouvelle clé API créée
☐ Variables DeepSeek/Anthropic/OpenAI (réutiliser V1)
☐ Toutes les variables exportées dans le shell local
☐ Netlify V1 INTACT — webhooks non modifiés
```

### Prêt ? Lance :

```bash
bash scripts/deploy-all-staging.sh
```

---

*Document généré le 2026-05-14. Commit : `27b77c04`*
