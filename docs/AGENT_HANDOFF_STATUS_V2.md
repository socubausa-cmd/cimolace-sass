# Agent Handoff Status V2

Dernière mise à jour : 2026-05-10

## Verdict de reprise

La base fonctionnelle à continuer est `isna-opus`.

Important : les dossiers `isna-opus`, `isna-pro`, `isna-flash` et `isna-sonnet` ressemblent à d'anciens worktrees Git, mais leurs liens Git sont cassés. Ne pas supposer que `git status` fonctionne dans ces dossiers. Recréer un dépôt propre avant tout merge sérieux.

Ne pas modifier la V1.

Clarification produit 2026-05-10 : Cimolace est la plateforme mère. ISNA/Ecole, LIRI, MedOS, Mbolo/VirtuelMbolo et les autres offres sont des produits ou moteurs du catalogue Cimolace activables par tenant. L'ancienne consigne "ne pas importer MedOS/CIMOLACE" signifiait : ne pas faire de fusion brute dans le MVP Ecole. Elle ne veut pas dire que MedOS est hors stratégie. Référence : `docs/CIMOLACE_PLATFORM_AUDIT.md`.

Clarification migration V1 2026-05-10 : tout le backend de `isna_app` n'a pas été migré. `isna-opus` contient le socle V2 stable, mais la majorité des produits V1 (LIRI complet, SmartBoard, course builder, booking, replay, billing multi-provider, forum, messagerie, back-office Cimolace, etc.) reste à migrer domaine par domaine. Référence : `docs/V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md`.

Clarification Mbolo/Zahir 2026-05-10 : ZahirWellness est un site client e-commerce déjà en ligne. Ne pas le modifier directement. Il doit être cloné/audité comme blueprint de Mbolo/VirtuelMbolo, puis migré progressivement vers une API e-commerce Cimolace multi-tenant. Référence : `docs/ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md`.

## Ce qui est déjà fait dans `isna-opus`

### Monorepo

- Racine `package.json` avec workspaces npm `apps/*`.
- `apps/api` : NestJS.
- `apps/app` : React + Vite.
- `apps/public-site` : Next.js.
- `apps/worker` : squelette worker.
- `packages/ui`, `packages/types`, `packages/config` : placeholders README.

### API fondation

- `GET /health`.
- `ConfigModule` global avec `.env` racine/app.
- CORS activé.
- `ValidationPipe` global.
- Réponse standard :
  - succès : `{ data }`
  - erreur : `{ error: { code, message } }`
- `rawBody: true` activé pour Stripe.

Fichiers :

- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/health.controller.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/interceptors/response.interceptor.ts`

### Auth et tenant

- Auth JWT Supabase via `passport-jwt`.
- Support tokens Supabase `ES256` via JWKS (`/auth/v1/.well-known/jwks.json`) + fallback `HS256`.
- `GET /auth/me`.
- `POST /tenants` crée un tenant et une membership owner.
- `GET /tenants/current` résout le tenant courant depuis `X-Tenant-Slug`.
- `PATCH /tenants/current/branding` pour owner/admin.
- `TenantGuard` vérifie :
  - utilisateur authentifié
  - header `X-Tenant-Slug`
  - slug formaté
  - membership active
- `RolesGuard` + `@Roles(...)` existent, mais ne couvrent pas encore toutes les ressources.

Fichiers :

- `apps/api/src/auth/*`
- `apps/api/src/tenant/*`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`

### Supabase

- Client service-role centralisé dans `SupabaseService`.
- Types locaux pour `tenants`, `tenant_memberships`, `access_passes`, `live_sessions`.
- Migrations présentes :
  - `20250505000001_tenants.sql`
  - `20250505000002_access_passes.sql`
  - `20250505000003_live_sessions.sql`
  - `20250505000004_marketing.sql`
  - `20250505000005_billing.sql`
- Seed présent :
  - `supabase/seeds/001_admin_seed.sql`
  - `supabase/seeds/002_marketing_seed.sql`

Attention : migrations présentes dans le repo ne veut pas dire appliquées en Supabase dev/staging.

Audit 2026-05-10 : la Supabase V2 configurée dans `apps/api/.env` répond. Tables vérifiées avec `select count` :

- `tenants`
- `tenant_memberships`
- `live_sessions`
- `access_passes`

### Live payant

- `POST /lives` : création live, owner/admin/teacher seulement.
- `GET /lives` : listing paginé basique via `limit`/`offset`.
- `GET /lives/:id` : détail live du tenant.
- `GET /lives/:id/token` : génère token LiveKit.
- Host roles `owner/admin/teacher` peuvent publier.
- Student doit avoir un `access_pass` actif.
- Vérification `expires_at` sur `access_pass`.
- Room LiveKit générée avec `randomUUID()`.
- `select('*')` évité sur live exposé.

Fichiers :

- `apps/api/src/live/*`
- `apps/api/src/livekit/*`

### Checkout élève connecté

- `POST /checkout/sessions` existe et requiert JWT.
- Le checkout ne requiert pas `TenantGuard`, car il retrouve `tenant_id` depuis `live_sessions`.
- Stripe Checkout réel via SDK.
- Idempotency key : `checkout-${userId}-${liveSessionId}`.
- `POST /checkout/webhook/stripe` public mais protégé par signature HMAC Stripe.
- Webhook vérifie `payment_status === 'paid'` avant d'accorder l'accès.
- Gère aussi :
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- Webhook crée/upsert :
  - `access_passes`
  - `tenant_memberships` role `student`
- En cas d'erreur DB critique, le webhook throw pour permettre retry Stripe.

Fichiers :

- `apps/api/src/checkout/*`

Ce qui n'est pas fait : checkout public sans JWT, magic link student, compte auto-créé après paiement. Ne pas le considérer comme implémenté.

Note audit 2026-05-10 : le code mort restant autour du checkout public/email a été retiré de `CheckoutService` pour éviter qu'un agent pense que ce flux est partiellement supporté.

Tests ajoutés 2026-05-10 :

- `apps/api/src/checkout/checkout.service.spec.ts`
- couvre création checkout connecté avec metadata tenant
- couvre refus si access pass déjà actif
- couvre webhook payé qui crée `access_passes` et `tenant_memberships(student)`

### App connectée

- Routes :
  - `/onboarding`
  - `/dashboard/lives`
  - `/dashboard/lives/new`
  - `/lives/:id/join`
- `authStore` debug stocke token Bearer et tenant slug en localStorage.
- Axios ajoute `Authorization` et `X-Tenant-Slug`.
- UI existante :
  - création tenant
  - listing lives
  - création live
  - paiement/rejoin live
  - LiveKitRoom après token

Note audit 2026-05-10 : `LiveJoin.tsx` a été corrigé pour proposer le checkout même quand le détail live est refusé avant paiement par `TenantGuard`. Cela garde le flux student connecté testable sans ajouter de route publique.

Fichiers :

- `apps/app/src/App.tsx`
- `apps/app/src/lib/api.ts`
- `apps/app/src/lib/auth-store.ts`
- `apps/app/src/pages/*`

### Public site

- Next.js App Router compile.
- Actuellement surtout squelette public/landing, pas encore pages publiques tenant/live complètes.

### Worker

- Squelette worker présent.
- Jobs IA, email, vidéo sont placeholders/TODO.
- Ne pas déplacer rendu vidéo dans API HTTP synchrone.

## Vérifications exécutées

Commandes passées :

```bash
npm run build -w @isna/api
npm run build -w @isna/app
npm test -w @isna/api
npm run build
```

Résultat :

- API build OK.
- App Vite build OK.
- Test API OK : 1 suite, 1 test.
- Build global OK, avec warning connu Next/SWC lockfile dans npm workspaces.

Dernière vérification après nettoyage checkout public + correction `LiveJoin.tsx` :

- `npm run build -w @isna/api` OK.
- `npm run build -w @isna/app` OK.
- `npm test -w @isna/api` OK : 2 suites, 4 tests.

E2E backend réel passé le 2026-05-10 :

- création users Supabase Auth test owner/student
- `GET /auth/me` avec vrai access token Supabase `ES256`
- `POST /tenants`
- `PATCH /tenants/current/branding`
- `POST /lives`
- refus student avant paiement
- `POST /checkout/sessions` Stripe test
- `POST /checkout/webhook/stripe` avec signature HMAC générée
- création `access_pass` + membership `student`
- `GET /lives/:id/token` OK après paiement simulé signé

Artefacts E2E créés en Supabase V2 :

- tenant slug `codex-e2e-202605100048`
- live id `70634421-5aaf-47f5-bf7d-6a49c1766443`
- users test `codex-owner-202605100048@example.test` et `codex-student-202605100048@example.test`

Warning connu :

- Next.js tente de patcher le lockfile/SWC et affiche `ENOWORKSPACES`; le build a néanmoins terminé avec succès. À nettoyer avant CI.

## Ce qui reste à faire maintenant

Priorité absolue :

1. Faire le test manuel navigateur avec paiement carte Stripe test complet.
2. Ouvrir l'app, coller le token student et le tenant slug, puis rejoindre la room LiveKit.
3. Corriger uniquement les bugs révélés par ce test manuel.
4. Décider le vrai flow “paiement d'abord -> compte auto-créé”.
5. Brancher `MarketingService` sur Supabase.

Runbook détaillé : `docs/E2E_RUNBOOK_V2.md`.

Après E2E seulement :

- Décider le vrai flow “paiement d'abord -> compte auto-créé”.
- Brancher MarketingService sur Supabase.
- Ajouter UI marketing.
- Ajouter tests d'intégration ciblés.

## Ne pas refaire

- Ne pas recréer tenant/auth/live/checkout depuis zéro.
- Ne pas réimporter MedOS/CIMOLACE par fusion brute dans le MVP Ecole. Intégrer d'abord le socle catalogue Cimolace, puis importer les modules produit de façon contrôlée.
- Ne pas commencer billing SaaS avant validation E2E live payant.
- Ne pas ajouter un checkout public/email bricolé sans flow d'auth student complet.
- Ne pas mettre de secrets dans Git.
- Ne pas toucher V1.

## Divergences entre dossiers agents

- `isna-opus` : base fonctionnelle MVP la plus complète.
- `isna-sonnet` : contient du billing SaaS API, mais hors phase actuelle.
- `isna-flash` : contient des migrations billing/Stripe Connect, hors phase actuelle.
- `isna-pro` : plus ancien/moins complet.
- `isna_platform_v2` : Git fonctionnel et source importante pour la vision catalogue Cimolace/MedOS, mais pas base technique la plus stable. A utiliser comme source d'inspiration et de modules à migrer proprement vers `isna-opus`.

## Risques ouverts

- Git/worktrees à reconstruire proprement.
- `.env` réel détecté dans certains dossiers locaux : vérifier qu'aucun secret n'est tracké/poussé, puis rotater si nécessaire.
- RLS non prouvée en base cloud tant que migrations non appliquées/testées.
- `RolesGuard` partiel.
- Marketing scaffold : contrôleurs présents, service non persistant.
- Billing doc/migration présents, mais API billing absente de `isna-opus`.
