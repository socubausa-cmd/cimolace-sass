# ISNA Platform V2 — Fusion

Date: 2026-05-17

## Dossier canonique unique

`/Users/ngowazulu/Downloads/isna_platform_v2`

Ce dossier est le seul a utiliser. `.isna-opus-consolidated/` est une archive.

## Apps

| App | Source |
|-----|--------|
| apps/api | consolidated (36 modules, Stripe/LiveKit) |
| apps/app | consolidated (React/Vite, 30+ pages) |
| apps/public-site | workspace original (Next.js, 17 pages) |
| apps/worker | consolidated (Node.js stub) |

## Sauvegarde

`.api.workspace/` = ancienne API 16 modules

## Commandes

```
npm run dev:api
npm run dev:app
npm run dev:public-site
npm run dev:worker
npm run build
```

## Variables a creer

- apps/public-site/.env.local
- apps/app/.env
- apps/worker/.env

## Apps manquantes

- apps/med-app
- apps/patient-portal

## A faire

sudo chown -R 501:20 ~/.npm

## Session 2026-05-17 (soir)

- Swagger active sur /docs
- .env.local cree pour public-site
- .env cree pour apps/app
- apps/med-app scaffold avec 8 pages (Dashboard, Patients, Notes SOAP, Prescriptions, Forms, Health, Programs)
- Routes API: ~130 endpoints documentes
- Worker: 7 jobs (video, billing, DLQ, email, AI, ping)
- Edge Functions: 33/33 migrees

## Session 2026-05-17 (soir #2)

- apps/patient-portal cree: 8 pages (Dashboard, Mon dossier, Notes, Formulaires, Journal sante, Programmes, Ordonnances, Messages)
- apps/med-app: build OK (289 KB)
- apps/patient-portal: build OK (282 KB)
- Commandes disponibles: npm run dev:med-app, npm run dev:patient-portal

## Session 2026-05-17 (finale)

### Workers rendus reels
- video.js: FFmpeg transcoding + R2 upload (Cloudflare)
- billing.js: Stripe API renewal + DLQ exponential backoff
- ai.js: Multi-provider fallback (DeepSeek > OpenAI > Anthropic)
- email.js: Resend API (deja operationnel)

### Bilan total
- 6 apps, 34 modules API, 7 workers, 330+ routes
- Swagger /docs
- Edge Functions: 33/33 migrees
- .env files pour public-site, app

### Auth Supabase
- packages/ui/auth.tsx: SupabaseProvider + useAuth hook partage
- med-app: Login page + auth guard
- patient-portal: Login page + auth guard
- Flow: signIn/signUp/signOut + onAuthStateChange
