# Environnements — ISNA V2

## Architecture

```
Utilisateur ──→ Cloudflare DNS (cimolace.com)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Vercel       Vercel     Google Cloud Run
   React/Vite   Next.js    NestJS (port 4000)
   (app)        (public)        │
        │           │           │
        └───────────┴───────────┤
                                ▼
                    ┌───────────────────┐
                    │   Supabase        │
                    │   (DB + Storage)  │
                    └───────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
           LiveKit Cloud    Stripe TEST     Resend
           (streaming)      (paiements)     (email)
```

---

## Dev (local)

| Service | URL | Commande |
|---------|-----|----------|
| API | `http://localhost:4000` | `npm run dev:api` |
| App | `http://localhost:5173` | `npm run dev:app` |
| Public Site | `http://localhost:3000` | `npm run dev:public` |
| Health | `http://localhost:4000/health` | `curl localhost:4000/health` |

---

## Staging (Cloud Run + Vercel)

| Service | URL | Hébergeur | Déploiement |
|---------|-----|-----------|-------------|
| API | `https://api.staging.cimolace.com` | Google Cloud Run | `bash scripts/deploy-api-cloudrun.sh` |
| App | `https://app.staging.cimolace.com` | Vercel | `bash scripts/deploy-app-vercel.sh` |
| Public Site | `https://staging.cimolace.com` | Vercel | `bash scripts/deploy-public-vercel.sh` |
| Supabase | Projet Staging dédié | Supabase | Manuel (SQL Editor) |
| LiveKit | Projet Staging dédié | LiveKit Cloud | Manuel (Dashboard) |

### Déploiement one-shot

```bash
# Tout déployer en une commande
bash scripts/deploy-all-staging.sh
```

---

## Production (cible)

| Service | URL | Hébergeur |
|---------|-----|-----------|
| API | `https://api.cimolace.com` | Google Cloud Run |
| App | `https://app.cimolace.com` | Vercel |
| Public Site | `https://cimolace.com` | Vercel |
| Supabase | Projet Production dédié | Supabase |
| LiveKit | Projet Production dédié | LiveKit Cloud |

---

## Variables d'environnement requises

### API (Cloud Run)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `SUPABASE_URL` | URL projet Supabase | Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` | Dashboard → Settings → API |
| `LIVEKIT_API_KEY` | Clé API LiveKit | Dashboard LiveKit → Settings |
| `LIVEKIT_API_SECRET` | Secret API LiveKit | Dashboard LiveKit → Settings |
| `LIVEKIT_URL` | URL WebSocket LiveKit | `wss://....livekit.cloud` |
| `STRIPE_SECRET_KEY` | Clé Stripe TEST | Dashboard Stripe → Developers |
| `STRIPE_BILLING_WEBHOOK_SECRET` | Signature webhook Stripe | Dashboard Stripe → Webhooks |
| `CHARIOW_API_KEY` | Clé Chariow (optionnel) | Dashboard Chariow |
| `CINETPAY_API_KEY` | Clé CinetPay (optionnel) | Dashboard CinetPay |
| `DEEPSEEK_API_KEY` | Clé DeepSeek AI | platform.deepseek.com |
| `ANTHROPIC_API_KEY` | Clé Anthropic (optionnel) | console.anthropic.com |
| `OPENAI_API_KEY` | Clé OpenAI (optionnel) | platform.openai.com |
| `RESEND_API_KEY` | Clé Resend email | Dashboard Resend |
| `RESEND_FROM` | Adresse expéditeur | `noreply@cimolace.com` |

### App React/Vite (Vercel Build Env)

| Variable | Préfixe Vite |
|----------|-------------|
| `VITE_API_URL` | URL de l'API |
| `VITE_SUPABASE_URL` | URL Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `VITE_LIVEKIT_URL` | URL LiveKit |

### Public Site Next.js (Vercel Build Env)

| Variable | Préfixe Next |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL de l'API |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |

---

## Fichiers de configuration

| Fichier | Rôle |
|---------|------|
| `Dockerfile` | Build image Docker pour Cloud Run |
| `.gcloudignore` | Fichiers exclus du build Cloud Run |
| `apps/app/vercel.json` | Config déploiement Vercel React/Vite |
| `apps/public-site/vercel.json` | Config déploiement Vercel Next.js |
| `scripts/deploy-api-cloudrun.sh` | Déploiement API |
| `scripts/deploy-app-vercel.sh` | Déploiement App |
| `scripts/deploy-public-vercel.sh` | Déploiement Public |
| `scripts/deploy-all-staging.sh` | Déploiement complet one-shot |
| `.github/workflows/ci.yml` | CI/CD GitHub Actions |
