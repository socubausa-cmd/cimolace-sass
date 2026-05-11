# Cahier des charges partagé — Migration ISNA / LIRI / CIMOLACE V2

## Objectif

Créer une V2 indépendante contrôlée du projet actuel sans arrêter le fonctionnement de la V1.

La V1 actuelle reste la référence fonctionnelle. La V2 est construite à côté avec une nouvelle infrastructure SaaS live/vidéo premium.

## Décision stratégique

Méthode retenue : **clone indépendant contrôlé**.

```txt
isna_app           = V1 actuelle, référence fonctionnelle
isna_platform_v2   = nouveau projet indépendant, nouvelle infrastructure
```

## Décision frontend stricte

Le frontend est séparé en deux produits :

```txt
apps/public-site   = Next.js pour pages publiques, SEO, commercial
apps/app           = React + Vite pour application connectée/back-office/studio/live
```

Le back-office n'a pas besoin de référencement. Il ne doit pas être migré vers Next.js juste par effet de mode.

## Décision infrastructure stricte

Netlify reste uniquement une référence historique de la V1. La V2 ne doit pas utiliser Netlify comme backend principal.

Infrastructure cible :

```txt
Cloudflare          DNS / WAF / CDN
Vercel/CF Pages     public-site + app
Google Cloud Run    API métier
Cloud Run Jobs      workers IA/vidéo/emails
Supabase V2         Postgres/Auth/Storage/Realtime
LiveKit Cloud       live vidéo
Mux/CF Stream       vidéo à la demande/replays
Inngest puis PubSub queue/workflows
```

## Principes non négociables

1. Ne pas casser la V1.
2. Ne pas dépendre de l'ancien Supabase bloqué.
3. Ne pas mettre de secret dans Git.
4. Ne pas migrer billing en premier.
5. Ne pas faire de rendu vidéo dans une API HTTP synchrone.
6. Ne pas tout migrer vers Next.js.
7. Ne pas reconstruire une V2 monolithique désordonnée.

## Technologies à garder

- React + Vite pour l'application connectée
- TailwindCSS
- Radix UI
- Framer Motion
- Supabase Postgres/Auth/Storage/Realtime
- LiveKit
- Capacitor si mobile conservé
- Vitest / Playwright

## Technologies à ajouter

- Next.js pour site public SEO
- NestJS/Fastify pour API métier
- Cloud Run pour API production
- Cloud Run Jobs pour workers
- Mux ou Cloudflare Stream pour vidéo
- Cloudflare pour DNS/WAF/CDN
- Inngest au démarrage, Pub/Sub/Cloud Tasks ensuite
- Sentry + logs centralisés

## Ordre de migration

1. Fondation V2
2. API minimale
3. Supabase V2 dev/staging
4. Marketing Tools
5. Forum/modération
6. Notifications/emails
7. IA longue
8. Vidéo/FFmpeg
9. Billing/paiement
10. Bascule DNS finale

## Répartition agents

### Windsurf / Cascade

- Coordination
- Documentation
- Structure V2
- `apps/app`
- intégration API frontend
- feature flags

### Claude

- `apps/api`
- auth JWT Supabase
- modules backend
- endpoints
- validation

### Cursor

- Supabase V2
- migrations
- seeds
- workers
- queue
- scripts import/export

## Première mission commune

- Créer workspace V2.
- Créer documentation.
- Créer Supabase V2 dev.
- Initialiser API minimale.
- Initialiser app React/Vite minimale.
- Initialiser public-site Next.js minimal.
- Initialiser worker minimal.
- Migrer Marketing Tools comme module pilote.
