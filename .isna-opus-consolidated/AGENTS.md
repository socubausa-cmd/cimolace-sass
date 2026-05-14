# Agent Rules — ISNA Platform V2

## Mission

Construire la V2 indépendante de ISNA / LIRI / CIMOLACE sans casser la V1.

## Règle absolue

Ne jamais modifier la V1 depuis ce workspace. La V1 sert de référence fonctionnelle.

## Architecture retenue

```txt
apps/public-site   Next.js pour pages publiques SEO
apps/app           React + Vite pour application connectée
apps/api           Backend métier NestJS/Fastify
apps/worker        Jobs IA, vidéo, emails, notifications
packages/ui        UI partagée
packages/types     Types partagés
packages/config    Configuration partagée
```

## Répartition agents — par criticité

> Principe : la criticité prime sur le domaine.
> "Ce bug coûte de l'argent ou expose une faille ?" → OUI = Sonnet/Opus. NON = DeepSeek V4 Pro ou Flash.

### Claude Opus — Coordinateur + Dernier rempart

Invoqué **sur demande uniquement**, pas en continu.

- Lire `AGENTS.md` + `ROADMAP_V2.md` + `PRODUCT_FLOWS_V2.md` en début de phase
- Décider quelles tâches vont à quel agent
- Review finale avant merge (sécurité, cohérence globale, invariants multi-tenant)
- Arbitrage quand un autre agent est bloqué ou en contradiction
- Conception des phases futures (Phase 2+, billing, IA, forum)

### Claude Sonnet — Code critique / sécurité

Tout ce où une erreur coûte de l'argent ou expose une faille :

- Auth JWT Supabase, guards, stratégies Passport
- Tenant resolution + isolation logique `tenant_id`
- Checkout Stripe + vérification signature webhook HMAC
- Logique `access_pass` (contrôle d'accès aux ressources payantes)
- RLS Supabase (design des policies)
- Tests d'intégration sur les flux critiques (paiement, accès live)

### DeepSeek V4 Pro — Volume de code standard

Fort en génération de code, économique, maximisé sur le non-sensible :

- `apps/app` — tous les écrans React/Vite (dashboard, studio, live, back-office)
- `apps/public-site` — pages Next.js marketing, SEO, landing
- Migrations SQL Supabase standards (schémas, indexes, tables non-critiques)
- `apps/worker` — jobs asynchrones (IA, FFmpeg, emails, notifications, cron billing)
- Queues Inngest, scripts import/export
- Endpoints CRUD classiques sans logique de sécurité

### DeepSeek Flash — Vitesse / scaffolding

Tâches rapides sans enjeu qualité :

- Seeds et fixtures de test
- Scaffolding nouveau module NestJS vide
- Documentation, README, JSDoc
- Petits bugs, reformatage, renommages
- Boilerplate (DTOs simples, modules, barrel exports)

## Interdictions

- Pas de secrets dans Git.
- Pas de dépendance directe à l'ancien Supabase bloqué.
- Pas de développement lourd avant validation de `docs/PRODUCT_FLOWS_V2.md`.
- Pas de schéma API sans modèle tenant explicite.
- Pas de migration billing en premier.
- Pas de rendu vidéo dans API HTTP synchrone.
- Pas de Netlify comme backend V2.
- Pas de migration globale sans module pilote.
- Pas de code qui contredit les 5 décisions produit verrouillées.

## MVP Manifest — Verrouillé

```txt
Client     : formateur indépendant (un seul avatar)
Tenant     : auto-création après inscription
Vente live : paiement à l'unité (pas d'abonnement)
Student    : paiement d'abord → compte auto-créé
Dogfooding : Prorascience est un tenant
```

Tout code qui contredit ces décisions sera rejeté.

## Premier module pilote

Avant le module pilote technique, valider le MVP métier :

```txt
tenant owner crée espace
  ↓
configure branding
  ↓
crée live payant
  ↓
student paye
  ↓
access pass créé
  ↓
student rejoint LiveKit
```

Ensuite seulement : Marketing Tools.

## Infrastructure cible production

- Cloudflare DNS/WAF/CDN
- Public site : Next.js sur Vercel/Cloudflare Pages
- App connectée : React/Vite sur Vercel/Cloudflare Pages
- API : NestJS sur Google Cloud Run
- Workers : Cloud Run Jobs
- DB/Auth : Supabase Pro en production
- Dev DB : nouveau Supabase dev/staging
- Live : LiveKit Cloud
- Vidéo : Mux ou Cloudflare Stream
- Queue : Inngest au départ, Pub/Sub/Cloud Tasks en production avancée
