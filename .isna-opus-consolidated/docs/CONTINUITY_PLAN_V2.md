# Continuity Plan V2

## Base de reprise

La base fonctionnelle la plus stable est `isna-opus`.

Important : `isna-opus` n'est pas encore une migration complete de `isna_app`. C'est le noyau stable pour reconstruire Cimolace V2. La cartographie V1 -> V2 est dans `docs/V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md`.

À conserver :

- `apps/api` : tenant, JWT Supabase, live, checkout Stripe, LiveKit.
- `apps/app` : onboarding tenant, dashboard lives, création live, page join/paiement.
- `apps/public-site` : squelette Next.js compilable.
- `supabase/migrations` : tenants, access_passes, live_sessions, marketing, billing spec.
- `docs` : roadmap, flows, sécurité, architecture.

À ne pas importer brutalement maintenant :

- Modules MedOS/CIMOLACE de `isna_platform_v2` : utiles pour la vision Cimolace, mais à migrer après le socle catalogue (`tenant_services`, templates d'infrastructures, activation par tenant).
- Billing SaaS de `isna-sonnet` : utile plus tard, mais Phase 5.
- Migrations billing/Stripe Connect de `isna-flash` : hors séquence MVP.

## État MVP au 2026-05-10

Fait :

- Build monorepo OK.
- Test API existant OK.
- Tenant owner peut créer un tenant.
- Owner/admin/teacher peut créer un live.
- Student connecté peut lancer un checkout via `POST /checkout/sessions`.
- Webhook Stripe crée `access_pass` et `tenant_membership`.
- Token LiveKit reste protégé : JWT + tenant + access pass.

Reste à prouver :

- E2E complet Stripe CLI -> webhook -> access_pass -> token LiveKit.
- Parcours produit final pour “paiement d'abord -> compte auto-créé”.
- Connexion réelle du student après auto-création du compte.
- Supabase dev/staging avec migrations appliquées.
- Nettoyage Git : les dossiers agents ne sont plus des worktrees valides.
- Rotation des secrets si un `.env` a déjà été tracké dans un dépôt distant.

## Ordre de continuité

1. Recréer une base Git propre à partir de `isna-opus` en excluant `.env`, `node_modules`, `dist`, `.next`, `supabase/.temp`.
2. Créer Supabase V2 dev/staging et appliquer les migrations fondation.
3. Configurer Stripe test + Stripe CLI + LiveKit.
4. Exécuter le E2E live payant.
5. Corriger les bugs révélés par le E2E.
6. Décider le flow student auto-créé avec une solution produit complète.
7. Brancher Marketing Tools sur Supabase.
8. Ajouter le socle catalogue Cimolace avant d'importer MedOS, Mbolo/VirtuelMbolo et les autres produits.
