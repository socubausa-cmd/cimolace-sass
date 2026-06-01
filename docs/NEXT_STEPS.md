# Next Steps

> **Statut réel** — les commandes et chemins supposent `isna-opus` comme base fonctionnelle MVP. Voir `docs/AGENT_HANDOFF_STATUS_V2.md` avant d'assigner un agent.

La checklist complète par phase est dans **`docs/ROADMAP_V2.md`** (section **Ordre d'exécution**). Le scénario opérationnel E2E est dans **`docs/E2E_RUNBOOK_V2.md`**. Ce fichier décrit **la suite immédiate** dans le même ordre.

## Déjà fait côté dépôt (référence)

- Git (`main`, `staging`, `agent/cursor-data-workers`)
- Racine **`package.json`** avec **workspaces npm** (`apps/*`) et scripts `dev:api`, `dev:app`, `dev:public-site`, `dev:worker`
- `.env.example` racine + `apps/*`
- `docs/MIGRATIONS_INVENTORY.md`
- Migrations SQL fondations : `supabase/migrations/20250505_001_tenants.sql`, `20250505_002_access_passes.sql`
- Seed : `supabase/seeds/001_admin_seed.sql`
- **`apps/api`** — NestJS 11, `GET /health`, CORS activé, port `PORT` (défaut **4000**)
- **`apps/app`** — React 19 + Vite 6 + TypeScript
- **`apps/public-site`** — Next.js 15 (App Router, Tailwind 4), `outputFileTracingRoot` pour le monorepo
- Worker minimal : `apps/worker` (`@isna/worker`, job ping)

## Déjà fait — feat/api-tenant-context (2026-05-05)

- **`SupabaseModule`** (`apps/api/src/supabase/`) — client service-role global ; nécessite `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dans `.env`.
- **`TenantModule`** (`apps/api/src/tenant/`) :
  - Convention tenant : header **`X-Tenant-Slug`** sur chaque requête protégée.
  - `TenantGuard` — lit le header, vérifie que l'utilisateur JWT a une `tenant_membership` active ; lève `400` si header absent, `404` si slug inconnu, `403` si pas de membership.
  - `GET /tenants/current` (guards : `JwtAuthGuard` + `TenantGuard`) — renvoie `{ data: { id, name, slug, plan, status, primary_domain, logo_url, userRole } }`.
  - `@CurrentTenant()` — décorateur injectant le `TenantContext` dans les handlers.
- **Format réponse standard** (`apps/api/src/common/`) :
  - Succès : `{ data: T }` (via `ResponseInterceptor`).
  - Erreur : `{ error: { code, message } }` (via `GlobalExceptionFilter`).
  - `/health` exempté via `@SkipResponseWrapper()` — reste `{ status, timestamp }`.

## Déjà fait — feat/api-phase-1-5-live-checkout (2026-05-05)

- **Migration SQL** `supabase/migrations/20250505_003_live_sessions.sql` — table `live_sessions` avec RLS.
- **LiveModule** (`apps/api/src/live/`) :
  - `POST /lives` — crée une session live (owner/admin/teacher, JWT + TenantGuard).
  - `GET /lives`, `GET /lives/:id` — lecture des sessions du tenant.
  - `GET /lives/:id/token` — vérifie membership + access_pass, retourne token LiveKit `{ token, roomName }`.
    - Host (owner/admin/teacher) → `canPublish: true, roomAdmin: true`.
    - Student → `canPublish: false, canSubscribe: true`.
- **LiveKitModule** global (`apps/api/src/livekit/`) — `generateHostToken` / `generateParticipantToken` (async `toJwt()` v2).
- **CheckoutModule** (`apps/api/src/checkout/`) :
  - `POST /checkout/sessions` (JWT, pas de TenantGuard) → vérifie idempotence, crée session Stripe, retourne `{ checkoutUrl }`.
  - `POST /checkout/webhook/stripe` (raw body, pas de JWT) → vérifie HMAC Stripe, crée `access_pass` + `tenant_membership(student)` via upsert.
  - Tests unitaires : création session connectée, refus access existant, activation webhook payé.
- **ValidationPipe** global + `rawBody: true` dans `main.ts`.
- **Variables** ajoutées à `apps/api/.env.example` : `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`.

## Test local Phase 1.5

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — écoute webhook Stripe (CLI Stripe requis)
stripe listen --forward-to localhost:4000/checkout/webhook/stripe

# Copier le webhook secret affiché et le mettre dans apps/api/.env STRIPE_WEBHOOK_SECRET=whsec_...
```

## À faire maintenant (ordre)

1. **Test manuel navigateur** — utiliser le tenant/live E2E ou en recréer un, payer avec carte Stripe test, puis rejoindre la room via l'app.
2. **Décision student checkout** — le socle connecté est prouvé ; choisir le vrai parcours “paiement d'abord → compte auto-créé” sans bricolage : magic link, invitation Supabase, ou table pending purchase.
3. **Phase 2** — Brancher le **Marketing** sur Supabase, puis UI `apps/app` et flag `USE_API_V2_MARKETING` / `VITE_USE_API_V2_MARKETING` (détail dans `ROADMAP_V2.md`).

## Commandes utiles (racine du monorepo)

```bash
npm install
npm run dev:api
npm run dev:app
npm run dev:public-site
npm run dev:worker
npm run build
```

Les apps ont été générées ; pour modifier une stack, préférez les générateurs officiels **dans** le dossier concerné pour éviter d’écraser la config partagée.

> **Note (Next.js + npm workspaces)** : lors de `next build`, des messages du type « Failed to patch lockfile » / `pnpm` peuvent apparaître si Next tente de réparer les binaires SWC ; le build peut tout de même réussir (`✓ Compiled successfully`). Si besoin, documentez une stratégie CI (p.ex. variable d’environnement ou installation explicite des `@next/swc-*` pour votre OS).

---

Ensuite : phases **3 → 6** (forum / notifications, IA & vidéo, billing complété côté abonnement tenant dans l’API, bascule prod) comme dans **`docs/ROADMAP_V2.md`**.
