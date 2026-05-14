# Roadmap V2

> **Statut réel** — l'audit du 2026-05-10 retient `isna-opus` comme base fonctionnelle MVP technique. Clarification produit : Cimolace est la plateforme mère, et ISNA/Ecole, LIRI, MedOS, Mbolo/VirtuelMbolo et les autres offres sont des produits ou moteurs activables par tenant. `isna_platform_v2` porte une vision catalogue utile, mais ne doit pas être fusionné brutalement sans arbitrage.
>
> **Migration V1** — le backend complet de `/Users/ngowazulu/Downloads/isna_app` n'est pas encore migré. Voir `docs/V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md` avant de reprendre un domaine produit.

## Ordre d'exécution (résumé)

À suivre dans cet ordre ; le détail des phases est ci‑dessous.

1. **Repo & secrets** — recréer une base Git propre depuis `isna-opus`, `.env` locaux depuis `.env.example` (non commités).
2. **Supabase V2** — Créer le projet cloud dev/staging, puis appliquer les migrations (CLI ou éditeur SQL).
3. **Squelettes apps** — `apps/api` (NestJS), `apps/app` (Vite), `apps/public-site` (Next.js), `apps/worker` (déjà minimal ; à faire évoluer aux phases 3–4).
4. **Phase 1** — API : health, JWT Supabase, `/auth/me`, rôles, résolution tenant, format de réponses.
5. **Phase 1.5** — Parcours payant → `access_pass` → token LiveKit → étudiant rejoint le live.
6. **Phase 2** — Marketing comme premier module pilote (feature flag).
7. **Phases 3 → 6** — Forum / notifications, IA & vidéo, billing, bascule prod.

Référence rapide : `docs/NEXT_STEPS.md`, `docs/CURSOR_INSTRUCTIONS.md`, `docs/MIGRATIONS_INVENTORY.md`.

### État code (dernière resynchro)

Cette section décrit l'état réel observé dans `isna-opus`. Les tâches **infra** (projet Supabase cloud, secrets, Stripe CLI) restent manuelles.

---

## Phase 0 — Fondation

### Décisions produit MVP

- [x] Valider `docs/PRODUCT_FLOWS_V2.md`
- [x] Valider `docs/TENANCY_AND_BACKEND_BOUNDARIES.md`
- [x] Répondre aux questions produit bloquantes
- [x] Verrouiller les 5 décisions produit MVP
- [x] Client principal : formateur indépendant
- [x] Tenant : auto-création après inscription
- [x] Vente live : paiement à l'unité
- [x] Student : paiement → compte auto-créé
- [x] Prorascience : tenant obligatoire

### Infra & dépôt

- [x] Initialiser Git (branches `main`, `staging`, `agent/cursor-data-workers`)
- [x] Modèles `.env.example` (racine + `apps/*`)
- [x] Inventaire migrations V1 : `docs/MIGRATIONS_INVENTORY.md`
- [x] Migrations SQL fondations dans le repo : `supabase/migrations/20250505_001_tenants.sql`, `20250505_002_access_passes.sql`
- [x] Seed test : `supabase/seeds/001_admin_seed.sql`
- [x] Créer le **projet** Supabase V2 dev/staging (dashboard) et renseigner les `.env` locaux — vérifié le 2026-05-10 via `apps/api/.env`
- [x] Appliquer les migrations sur ce projet (`supabase link` / `db push` ou SQL Editor) — tables MVP vérifiées en Supabase réel
- [x] Initialiser `apps/api` (NestJS) — monorepo `npm`, `GET /health` sur le port `PORT` (défaut 4000)
- [x] Initialiser `apps/app` (React + Vite + TypeScript)
- [x] Initialiser `apps/public-site` (Next.js 15 + App Router + Tailwind)
- [x] Initialiser `apps/worker` (squelette Node + job ping ; dépendances installées localement au besoin)

---

## Phase 1 — API minimale

- [x] Schéma tenant minimal (SQL dans le repo ; effectif en base après étape « Appliquer les migrations »)
- [x] Table `tenant_memberships` (idem)
- [x] Résolution tenant courante (API) — header `X-Tenant-Slug`, `TenantGuard`, 403 si pas de membership
- [x] `GET /health`
- [x] Auth Supabase JWT (Bearer access token)
- [x] Auth Supabase JWT ES256/JWKS + fallback HS256
- [x] `GET /auth/me`
- [x] `GET /tenants/current` — tenant + rôle utilisateur
- [ ] Rôles utilisateur (contrôle fin par ressource) — *partiel : `RolesGuard` + `@Roles` sur routes ciblées (ex. `POST /lives`, branding), pas de RBAC généralisé par ressource*
- [x] Format réponse API standard — `{ data }` succès / `{ error: { code, message } }` erreurs

---

## Phase 1.5 — MVP métier obligatoire

- [x] Création tenant owner — `POST /tenants` (JWT seul, crée tenant + membership owner, 409 si slug pris)
- [x] Branding minimal tenant — `PATCH /tenants/current/branding` (owner/admin ; client `tenantsApi.updateBranding` dans `apps/app`)
- [x] Migration SQL `live_sessions` (tenant_id, host, price_cents, currency, livekit_room_name, status…)
- [x] Création live payant — `POST /lives` (owner/admin/teacher uniquement)
- [x] Listing + détail lives — `GET /lives`, `GET /lives/:id`
- [x] Checkout Stripe — `POST /checkout/sessions` → retourne `{ checkoutUrl }`
- [x] Webhook Stripe — `POST /checkout/webhook/stripe` → crée `access_pass` + `tenant_membership` student
- [x] Token LiveKit — `GET /lives/:id/token` (host = publish, student = subscribe ; vérifie access_pass)
- [x] Test backend E2E : Supabase réel → API locale → Stripe Checkout → webhook signé → access_pass → token LiveKit
- [ ] Test manuel navigateur : paiement carte Stripe test complet + rejoindre room LiveKit dans l'app
- [ ] Décider le vrai parcours student “paiement d'abord → compte auto-créé” après preuve E2E du socle connecté

---

## Phase 2 — Module pilote Marketing

- [x] Schéma marketing en SQL dans le repo — `promo_codes`, `popups`, `banners` + RLS (`20250505000004_marketing.sql` ; fichier historique `20250505_004_marketing.sql` — **à consolider** pour éviter doublons sur base neuve)
- [x] Routes HTTP `/marketing/*` (CRUD promo / popup / bannière)
- [x] Persistance réelle : `MarketingService` branché sur Supabase avec filtrage `tenant_id`
- [x] Service frontend marketing (`apps/app` — client `marketingApi` pour `/marketing`)
- [x] Feature flag — API `USE_API_V2_MARKETING` ; exemple front `VITE_USE_API_V2_MARKETING` dans `apps/app/.env.example`
- [x] Tests création code promo/popup/bannière

---

## Phase 3 — Forum et notifications

- [ ] Forum API
- [ ] Modération
- [ ] Notifications
- [ ] Emails async

---

## Phase 4 — IA et vidéo

- [ ] Worker IA
- [ ] Render queue
- [ ] Worker FFmpeg
- [ ] Intégration Mux/Cloudflare Stream

---

## Phase 5 — Billing

- [ ] Audit paiement V1
- [ ] API billing V2 (base) — présent dans `isna-sonnet`, pas dans `isna-opus`; à reporter après MVP live
- [ ] Webhook Stripe billing — présent dans `isna-sonnet`, pas dans `isna-opus`; à reporter après MVP live
- [ ] Tests sandbox billing (parcours complets + idempotence événements)
- [ ] Migration prudente (données / abonnements depuis V1)

---

## Phase 6 — Bascule

- [ ] Tests staging complets
- [ ] Migration données finale
- [ ] DNS Cloudflare
- [ ] Monitoring
- [ ] V1 conservée en backup
