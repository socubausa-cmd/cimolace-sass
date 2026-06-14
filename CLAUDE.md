# Cimolace (ex « ISNA Platform V2 ») — Guide pour agents IA et nouveaux développeurs

> ⚠️ **À LIRE EN PREMIER : [docs/REGLES_ARCHITECTURE_CIMOLACE.md](docs/REGLES_ARCHITECTURE_CIMOLACE.md)** — vocabulaire (Cimolace ≠ tenant ≠ moteur), structure `liri/ studio-creator/ school/`, et les **5 règles d'or** (Liri reste autonome — vérifié par ESLint · une seule coque `App.jsx` · pas d'import direct `@/tenants/isna` (passer par le seam `activeTenantConfig`) · pas de couleur `#D4AF37` en dur (utiliser `var(--school-accent)`) · catalogue = source backend). Ne pas re-confondre Cimolace / ISNA / Liri / Studio Créateur.

## Architecture générale

Monorepo npm workspaces. Six applications indépendantes, une API centrale.

```
apps/
  api/            NestJS 11 — API REST + WebSocket (port 4002)
  app/            React + Vite — Admin / Backoffice tenant (port 5173)
  med-app/        React + Vite — Interface praticien MedOS (port 5174)
  patient-portal/ React + Vite — Portail patient (port 5175)
  public-site/    Next.js — Site public Cimolace (port 3000)
  worker/         Inngest — Jobs asynchrones (IA, email, vidéo)
```

## Commandes essentielles

```bash
# Lancer toutes les apps en dev
npm run dev:api           # API NestJS  → http://localhost:4002
npm run dev:app           # Admin app   → http://localhost:5173
npm run dev:med-app       # Med app     → http://localhost:5174
npm run dev:patient-portal # Patient    → http://localhost:5175

# Tests API (depuis apps/api/)
cd apps/api
npx jest                  # tous les tests
npx jest --no-coverage "nom.spec"  # un fichier précis

# Typecheck
cd apps/api && npx tsc --noEmit -p tsconfig.json
cd apps/app && npx tsc --noEmit -p tsconfig.json

# Déploiement staging
cp .env.staging.example .env.staging  # remplir les replace_me
bash scripts/deploy-all-staging.sh
```

## API NestJS — Structure (apps/api/src/)

36 modules, 36 contrôleurs, ~120 services. Chaque module suit le pattern :
```
module-name/
  module-name.module.ts
  module-name.controller.ts
  module-name.service.ts
  module-name.service.spec.ts  (tests Jest + ts-jest)
  dto/
```

### Modules principaux

| Module | Route | Rôle |
|--------|-------|------|
| `tenants` | `/tenants` | Gestion tenants + membres |
| `medos` | `/med/*` | Dossiers patients, notes SOAP, formulaires |
| `med-charting` | `/med/charting` | Transcription Deepgram + génération SOAP (Claude) |
| `lives` | `/lives` | Sessions live + tokens LiveKit |
| `billing` | `/billing`, `/checkout` | Stripe, CinetPay, Chariow, PawaPay |
| `liri-brain` | `/liri-brain` | Chat IA multi-modèles |
| `cimolace-backoffice` | `/cimolace-backoffice` | Backoffice global Cimolace (guard staff) |
| `course-builder` | `/courses` | Formations, modules, leçons |
| `smartboard` | `/smartboard` | Tableau augmenté IA |
| `marketing` | `/marketing` | Bannières, popups, codes promo |
| `livekit` | `/livekit` | Webhook LiveKit + enregistrements |
| `chat` | `/chat` | Messagerie temps réel |

### Auth & Guards
- Toutes les routes sont protégées par `JwtAuthGuard` (NestJS global).
- L'identité tenant est résolue via le header `X-Tenant-Slug`.
- `CimolaceStaffGuard` restreint le backoffice aux emails de `CIMOLACE_BACKOFFICE_ADMIN_EMAILS` ou à la table `cimolace_staff_members`.

### Swagger
Disponible sur `http://localhost:4002/api` en dev.
Tous les DTOs sont décorés `@ApiProperty` / `@ApiPropertyOptional`.
Tous les contrôleurs ont `@ApiTags` + `@ApiBearerAuth`.

## Base de données — Supabase

RLS activée sur toutes les tables sensibles. Migrations SQL dans :
```
apps/api/src/migrations/      # migrations historiques numérotées
supabase/migrations/          # migrations Supabase CLI (timestamp)
```

Tables principales :
- `tenants`, `tenant_memberships`, `tenant_invitations`
- `med_patients`, `med_notes`, `med_health_entries`, `med_form_responses`
- `med_note_reads`, `med_charting_jobs`
- `live_sessions`, `access_passes`
- `cimolace_clients`, `cimolace_sites`, `cimolace_services`
- `billing_subscriptions`, `billing_transactions`, `cimolace_invoices`

## Worker (apps/worker/src/)

Lancé via `tsx src/index.ts`. Architecture polling (pas Inngest) :

| Fichier | Intervalle | Rôle |
|---------|-----------|------|
| `jobs/ping.js` | 10s | Heartbeat |
| `jobs/ai.js` | 10s | Polling `ai_jobs` → LLM (DeepSeek/OpenAI/Anthropic) |
| `jobs/email.js` | 15s | Polling `email_queue` → Resend |
| `jobs/video.js` | 30s | Polling `render_jobs` → FFmpeg + Cloudflare R2 |
| `jobs/billing.js` | 1h / 5min | Renouvellements Stripe + DLQ |

**`src/index.js`** — doublon obsolète de `index.ts`, ne pas exécuter.

**`generateAiContent.ts`, `processVideo.ts`, `sendEmail.ts`** — ébauches Inngest non branchées dans le worker principal (réservées pour une migration Inngest future).

## Frontends

### Admin App (apps/app) — React + Vite
- Axios `api` instance avec interceptors JWT dans `src/lib/api.ts`
- State global : `authStore` (Zustand), `tenantStore`
- Routes lazy-loaded dans `src/App.jsx`
- Pages tenant sous `/t/:tenantSlug/...`

### Patient Portal (apps/patient-portal) — React + Vite
- Auth via `localStorage` (token Supabase)
- Fetch natif avec `authHeaders()` helper
- Routes : `/dashboard`, `/records`, `/notes`, `/charting-notes`, `/health`, `/prescriptions`, `/forms`, `/programs`, `/messages`

### Med App (apps/med-app) — React + Vite
- Interface praticien : dossiers patients, charting audio→SOAP

## Variables d'environnement critiques

Voir `.env.staging.example` à la racine pour la liste complète.

Variables **obligatoires** pour démarrer l'API :
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
LIVEKIT_API_KEY + LIVEKIT_API_SECRET + LIVEKIT_URL
```

Variables **obligatoires** pour le checkout :
```
STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
```

## Conventions de code

- TypeScript strict sur toute la codebase API
- Strings avec apostrophes françaises → **double quotes** dans les decorateurs TS :
  `description: "Type d'infrastructure"` ✅ — `description: 'Type d\'infrastructure'` ❌
- Tests : un `.service.spec.ts` par service, lancé depuis `apps/api/` avec `npx jest`
- DTOs : toujours `@ApiProperty` + `class-validator` decorators
- Supabase client : toujours `(this.supabase.client as any).from(...)` (pas de typage générique)

## CI/CD

`.github/workflows/ci.yml` : typecheck + lint + tests sur push `main`/`staging`.

Scripts de déploiement staging :
```bash
bash scripts/deploy-api-cloudrun.sh   # API → Google Cloud Run (port 8080)
bash scripts/deploy-app-vercel.sh     # Admin app → Vercel
bash scripts/deploy-public-vercel.sh  # Public site → Vercel
bash scripts/deploy-all-staging.sh    # Tout en une commande
```

## Tests E2E

```bash
# Flow complet (user → tenant → live → checkout → access_pass → LiveKit token)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/e2e_test.js

# Flow MedOS (praticien → patient → notes → santé → RBAC)
PRAC_TOKEN=... PAT_TOKEN=... bash scripts/medos_e2e_test.sh
# Générer des tokens frais :
node scripts/gen-jwt.mjs
```
