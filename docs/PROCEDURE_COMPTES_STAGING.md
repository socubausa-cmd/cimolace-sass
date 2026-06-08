# PROCEDURE DE CREATION DE COMPTES — ISNA V2 Staging

**Objectif :** Configurer 5 services externes avec des projets V2 **séparés** des projets V1, en réutilisant les credentials existants comme base.

**Règle de sécurité :** Ne JAMAIS modifier, supprimer ou écraser les projets V1 (Netlify, Supabase, LiveKit, Stripe, Resend). Créer des projets **parallèles** dédiés à V2.

---

## SERVICES À CONFIGURER (5)

| # | Service | V1 (NE PAS TOUCHER) | V2 Staging (À CRÉER) |
|---|---------|--------------------|-----------------------|
| 1 | **Supabase** | Projet V1 existant (URL : voir VITE_SUPABASE_URL dans `.env.local` V1) | Nouveau projet "cimolace-staging" |
| 2 | **LiveKit Cloud** | Projet V1 existant | Nouveau projet "cimolace-staging" |
| 3 | **Stripe** | Compte existant, probablement en **mode TEST** | **Même compte, mode TEST, clés séparées** |
| 4 | **Resend** | Compte existant, domaine vérifié | Nouvelle clé API dédiée V2 |
| 5 | **GitHub** | Même repo `socubausa-cmd/cimolace-sass` | Nouveaux Secrets dans Settings |

> ℹ️ Les clés DeepSeek, Anthropic, OpenAI sont des API keys — **aucune création de compte nécessaire**, elles seront réutilisées telles quelles.

---

## ÉTAPE 1 — Supabase V2 Staging (5 min)

### 1.1 Créer le projet

1. Aller sur https://supabase.com
2. Cliquer **New project**
3. Nom : `cimolace-staging` (ou `cimolace-v2`)
4. Organisation : choisir la même que V1
5. Database Password : générer un mot de passe fort (le sauvegarder)
6. Region : **même région que V1** (ex: `eu-west-1` pour l'Europe, `us-east-1` pour US)
7. Pricing Plan : **Free** (suffisant pour le staging)

### 1.2 Récupérer les credentials

Dashboard Supabase V2 → Settings → API → copier :

| Variable V2 | Valeur |
|-------------|--------|
| `SUPABASE_URL` | `Project URL` (ex: `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (ex: `eyJh...`) |
| `SUPABASE_ANON_KEY` | `anon public` |

### 1.3 Conserver V1 intact

Le projet V1 reste accessible à son URL. Ne PAS supprimer, ne PAS modifier.

> **Vérification :** Avant de continuer, confirmer que l'URL V1 est différente de l'URL V2.

---

## ÉTAPE 2 — LiveKit Cloud V2 Staging (3 min)

### 2.1 Créer le projet

1. Aller sur https://cloud.livekit.io
2. Cliquer **New Project**
3. Nom : `cimolace-staging`
4. Region : **même région que Supabase** (pour minimiser la latence)

### 2.2 Récupérer les credentials

Dashboard LiveKit V2 → Settings → Keys → copier :

| Variable V2 | Valeur |
|-------------|--------|
| `LIVEKIT_URL` | `wss://xxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | `APIxxx` |
| `LIVEKIT_API_SECRET` | `secret...` |

### 2.3 Rooms V2 vs V1

Les rooms V2 utiliseront le préfixe implicite du tenant. Aucun risque de collision avec les rooms V1.

> **Vérification :** L'URL LiveKit V2 doit être différente de celle V1.

---

## ÉTAPE 3 — Stripe (mode TEST, 2 min)

Stripe est le cas spécial — le même compte sera utilisé pour V1 ET V2, mais en **mode TEST** avec des clés séparées.

### 3.1 Activer le mode TEST

Dashboard Stripe → activer **Test mode** (toggle en haut à droite).

### 3.2 Récupérer les clés TEST

Dashboard Stripe → Developers → API Keys → copier :

| Variable V2 | Valeur |
|-------------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` (clé secrète TEST) |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `whsec_...` (à générer après déploiement API) |

### 3.3 Conserver V1 intact

- Les clés V1 sont `sk_live_...` si production, ou autres clés TEST (`sk_test_...`). 
- Ne PAS les modifier. V2 utilise ses propres clés.

> **Alternative :** Si tu préfères une isolation totale, tu peux créer un **deuxième compte Stripe séparé**. Pas nécessaire en staging.

---

## ÉTAPE 4 — Resend (2 min)

### 4.1 Récupérer une nouvelle clé API

1. Aller sur https://resend.com
2. Dashboard → API Keys → **Create New Key**
3. Nom : `cimolace-staging`

### 4.2 Vérifier le domaine

Si tu as déjà vérifié `cimolace.com` sur le compte V1, V2 peut l'utiliser avec le sous-domaine `staging.cimolace.com`.

> **Alternative :** Utiliser `noreply@staging.cimolace.com` avec Resend sans vérification de domaine.

### 4.3 Credentials

| Variable V2 | Valeur |
|-------------|--------|
| `RESEND_API_KEY` | `re_...` (nouvelle clé) |
| `RESEND_FROM` | `noreply@staging.cimolace.com` |

---

## ÉTAPE 5 — GitHub Secrets (5 min)

Dans **GitHub → Repo `socubausa-cmd/cimolace-sass` → Settings → Secrets and variables → Actions**,
ajouter les 12 secrets V2 :

| # | Nom du secret | Valeur (de l'étape correspondante) |
|---|--------------|-------------------------------------|
| 1 | `SUPABASE_URL_STAGING` | Étape 1 — Project URL |
| 2 | `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Étape 1 — service_role key |
| 3 | `SUPABASE_ANON_KEY_STAGING` | Étape 1 — anon key |
| 4 | `LIVEKIT_URL` | Étape 2 — wss://... |
| 5 | `LIVEKIT_API_KEY` | Étape 2 — APIxxx |
| 6 | `LIVEKIT_API_SECRET` | Étape 2 — secret |
| 7 | `STRIPE_SECRET_KEY` | Étape 3 — sk_test_... |
| 8 | `STRIPE_BILLING_WEBHOOK_SECRET` | Étape 3 — whsec_... (après création webhook) |
| 9 | `DEEPSEEK_API_KEY` | Réutiliser la même que V1 |
| 10 | `ANTHROPIC_API_KEY` | Réutiliser la même que V1 (optionnel) |
| 11 | `OPENAI_API_KEY` | Réutiliser la même que V1 (optionnel) |
| 12 | `RESEND_API_KEY` | Étape 4 — re_... |
| 13 | `RESEND_FROM` | Étape 4 — noreply@staging.cimolace.com |

---

## TABLE DE MAPPAGE V1 → V2

| Variable V1 (Netlify/Supabase) | Variable V2 (GitHub Secrets / .env) | Compte |
|-------------------------------|-------------------------------------|--------|
| `VITE_SUPABASE_URL` | `SUPABASE_URL_STAGING` | Nouveau projet V2 |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Nouveau projet V2 |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY_STAGING` | Nouveau projet V2 |
| `LIVEKIT_URL` | `LIVEKIT_URL` | Nouveau projet V2 |
| `LIVEKIT_API_KEY` | `LIVEKIT_API_KEY` | Nouveau projet V2 |
| `LIVEKIT_API_SECRET` | `LIVEKIT_API_SECRET` | Nouveau projet V2 |
| `STRIPE_SECRET_KEY` (V1) | `STRIPE_SECRET_KEY` | Même compte, mode TEST |
| `STRIPE_WEBHOOK_SECRET` (V1) | `STRIPE_BILLING_WEBHOOK_SECRET` | Même compte, mode TEST |
| `DEEPSEEK_API_KEY` (V1) | `DEEPSEEK_API_KEY` | Même clé |
| `RESEND_API_KEY` (V1) | `RESEND_API_KEY` | Nouvelle clé dédiée V2 |
| `CHARIOW_API_KEY` (V1) | `CHARIOW_API_KEY` | Même clé (optionnel) |
| `CINETPAY_API_KEY` (V1) | `CINETPAY_API_KEY` | Même clé (optionnel) |

---

## VÉRIFICATION FINALE

Avant de lancer le déploiement, vérifier :

```
☐ Supabase V1 est toujours accessible
☐ LiveKit V1 est toujours accessible
☐ Toutes les URLs V2 sont DIFFÉRENTES des URLs V1
☐ Les clés Stripe V2 utilisent le mode TEST (sk_test_...)
☐ Les secrets GitHub V2 ne contiennent AUCUNE clé de production V1
☐ Les comptes Chariow, CinetPay (si utilisés) conservent leurs clés V1 intactes
```

---

*Procédure générée le 2026-05-14. Commit : `1819f65a`*
