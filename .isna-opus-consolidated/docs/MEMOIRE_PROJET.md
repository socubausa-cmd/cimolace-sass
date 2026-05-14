# MÉMOIRE PROJET — ISNA Consolidated V2

Date : 2026-05-14
Dernière mise à jour : Session 9 — TOUS LES BLOCS TERMINÉS

---

## Résumé exécutif

**ISNA Consolidated V2** (`isna-opus`) est la plateforme SaaS multi-tenant Cimolace.
La V1 (`isna_app`) reste la référence fonctionnelle — 165 Netlify Functions, 34 Edge Functions, 398 pages.
La V2 reconstruit proprement sur NestJS + React/Vite avec isolation tenant.

**État global** : 8 blocs sur 8 migrés. Les fondations multi-tenant sont opérationnelles.

---

## Architecture

```
apps/
├── api/          NestJS 11 — 31 modules, port 4000
├── app/          React 19 + Vite 6 — ~180 pages
├── public-site/  Next.js 15 — site SEO
└── worker/       Jobs Node — placeholder

supabase/
├── migrations/   3 fichiers de migration V2
└── seeds/        Données de test
```

---

## État de migration — TOUS LES BLOCS TERMINÉS

| Bloc | Domaine | Statut | Pages | Endpoints |
|------|---------|--------|-------|-----------|
| **1** | **Studio LIRI** | ✅ | 7 pages | 16 |
| **2** | **Billing SaaS multi-provider** | ✅ | 0 | 10 |
| **3** | **Live immersif + Arena** | ✅ | 0 | 8 |
| **4** | **SmartBoard Designer** | ✅ | 1 page | 14 |
| **5** | **Course Builder + Post-Prod** | ✅ | 1 page | 12 |
| **6** | **NeuroRecall + Débats** | ✅ | 0 | 8 |
| **7** | **Cimolace Backoffice** | ✅ | 0 | 5 |
| **8** | **Marketing avancé + Growth** | ✅ | 0 | 6 |

**Total : 9 pages frontend, 79 endpoints API, 3 migrations SQL**

---

## Détail par Bloc

### Bloc 1 — Studio LIRI
- 7 pages : Hub, Course Builder, Formation Builder, Masterclass, Export, Biblio, SmartBoard
- 3 modules API : masterclass-factory, studio, smartboard
- 1 migration SQL (5 tables)

### Bloc 2 — Billing SaaS
- 3 providers : Stripe, Chariow, CinetPay
- Webhooks multi-provider avec idempotence
- Subscriptions, invoices, payment accounts

### Bloc 3 — Live immersif
- Rooms immersives, companion, mobile camera
- Recordings start/stop, invitations
- Débats avec votes

### Bloc 4 — SmartBoard avancé
- Score qualité (6 dimensions)
- Versioning (historique, restore, fork)
- Dashboard, thèmes complets, tonalités, bibliothèque pédagogique

### Bloc 5 — Course Builder
- Segmentation IA (via masterclass-factory)
- Master script, génération segments, approbation
- Render jobs, post-prod versioning

### Bloc 6 — NeuroRecall
- Bootstrap session (flashcards IA)
- Spaced repetition, node reports
- Post-production content from pipelines

### Bloc 7 — Cimolace Backoffice
- Dashboard KPI, clients, sites
- Subscriptions, support tickets

### Bloc 8 — Marketing avancé
- Leads, funnels, campagnes, automations
- Analytics (conversion, acquisition)

---

## Commandes

```bash
cd .isna-opus-consolidated
npm run dev:api       # → localhost:4000
npm run dev:app       # → Vite dev server
npm run build         # Build everything
```

---

## Documentation

| Document | Contenu |
|----------|---------|
| `MEMOIRE_PROJET.md` | Ce fichier — mémoire centrale |
| `STUDIO_LIRI_MIGRATION.md` | Bloc 1 détaillé |
| `ROADMAP_V2.md` | Roadmap originale |
| `ARCHITECTURE_V2.md` | Architecture cible |
