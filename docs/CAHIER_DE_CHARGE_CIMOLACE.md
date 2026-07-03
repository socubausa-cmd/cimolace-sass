# CAHIER DE CHARGE — CIMOLACE (produit, de bout en bout)

> **Statut : CANONIQUE — v1.0 · 2026-07-03.**
> Ce document remplace et prime sur toutes les strates antérieures (ARCHITECTURE_V2, PRODUCT_FLOWS_V2, CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH, ENVIRONMENTS « Cloud Run », runbook « Cloud Run », README « lire V2 d'abord »). Ces documents décrivent des états périmés ou des cibles jamais atteintes ; ils doivent porter une bannière *OBSOLÈTE — voir CAHIER_DE_CHARGE_CIMOLACE.md*.
> Chaque affirmation d'état porte un marqueur : ✅ livré+prouvé · 🟡 partiel/à durcir · 🔴 cassé/manquant. Fondé sur l'audit orchestré du 2026-07-03 (14 agents, code + prod).

---

## 1. VISION PRODUIT

**Cimolace est l'infrastructure numérique invisible qui fait tourner des plateformes métier — comme Stripe fait tourner le paiement et Zoom la visioconférence.** Un client (une école, une clinique, un commerçant, un créateur, un média) active un ou plusieurs **OS métier** prêts à l'emploi, garde **sa marque, son domaine, ses données**, et Cimolace opère les moteurs en coulisses.

Trois modes de consommation, jamais croisés (cloison stricte) :
1. **HÉBERGÉ** — le client utilise le portail que Cimolace héberge (`liri.cimolace.space`, `med.cimolace.space`, back-office `/cimolace/billing`).
2. **EMBARQUÉ** — le client intègre un moteur dans **son propre site** via iframe/widget/SDK+clé API (façon Stripe/Zoom). C'est le différenciateur.
3. **MARQUE BLANCHE / DOMAINE PROPRE** — le moteur tourne sur le domaine du client (`ecole.exemple.com`), Cimolace reste invisible.

**Principe directeur** : *tout moteur, toute technologie Cimolace doit être activable à la carte et intégrable dans n'importe quel site.*

---

## 2. REALMS (cloison stricte — règle DURE)

| Realm | Rôle | Surface | Ne doit JAMAIS mener vers |
|---|---|---|---|
| **Cimolace** | Le SaaS / back-office (opérateur + client) | `/cimolace/*` (public, admin, billing) | LIRI, tenant |
| **LIRI** | Le PRODUIT live+IA multi-tenant (hôte neutre) | `liri.cimolace.space`, `/liri/*` | ISNA/tenant en dur |
| **Tenants / écoles** | L'instance d'UN client (ISNA, zahirwellness…) | `/t/:slug/*`, domaine propre | LIRI hébergé, Cimolace admin |

Cloison login prouvée (0 fuite sur 6 comptes × 2 méthodes). Toute page de connexion atterrit dans SON realm. **Ne jamais coder `isna` en dur** : c'est le 1er tenant, pas la plateforme.

---

## 3. INFRASTRUCTURE RÉELLE (source de vérité — fin de la confusion inter-repos)

- **Monorepo unique = `~/Downloads/cimolace`** (remote `github.com/socubausa-cmd/cimolace-sass`). ⚠️ `~/Downloads/isna_platform_v2` **N'EST PLUS un repo** (dossier d'images) — toute doc/mémoire qui y pointe est périmée.
- **API (control-plane)** = `apps/api` (NestJS, 49 modules, ~740 endpoints) → **Railway** projet `isna-api`/production, build `Dockerfile.full`, healthcheck `/health`. Sert **`api.cimolace.space`**. ⚠️ PAS Cloud Run (header `server: railway-hikari`).
- **Front applicatif** = `apps/app` (React/Vite) → **Vercel** projet `app`, sert `app.cimolace.space` + `liri.cimolace.space` + `prorascience.org` (branding décidé par le domaine).
- **Site vitrine SaaS** = `apps/public-site` → Vercel `public-site`, sert `cimolace.space`.
- **Espace praticien MEDOS** = `apps/med-app` → Vercel `med-app`, sert `med.cimolace.space`.
- **Worker (pollers)** = `apps/worker` → Railway `isna-worker` (ai/email/video/billing/replay/RGPD).
- **DB** = Supabase prod `fwfupxvmwtxbtbjdeqvu` (⚠️ le « dev » des docs E2E = cette prod).
- **Déploiement** : API `railway up -s isna-api --ci` (depuis un worktree propre de HEAD si session // active) ; Front `bash scripts/deploy-app-vercel.sh --prod` (ou `--archive=tgz`). SQL prod ad-hoc (schéma prod divergé des migrations — vérifier via `pg_policies`, jamais supposer).

---

## 4. LES MOTEURS (OS métier)

| Moteur | Clé API | Préfixe `tenant_services` | État |
|---|---|---|---|
| **LIRI** (live+IA, studio, smartboard, replay, école-live) | `lk_live_` / clé tenant | `liri_*` (8 moteurs) | ✅ moteurs solides multi-tenant · 🔴 gating runtime décoratif |
| **MEDOS** (santé : EHR, SOAP, téléconsult, FHIR, twin, RGPD) | `mdk_` | `med_*`, `gdpr_engine` | ✅ le plus abouti (186 endpoints, gating fail-closed) |
| **mbolo** (commerce : catalogue, panier, checkout, promo) | `mbk_` | `mbolo_*` | ✅ CRUD + storefront · 🟡 promo au panier, paylinks manquants |
| **École / Formation** | clé tenant | `school`, `formations`… | 🟡 moteurs vivants · 🔴 provisioning/onboarding payant mort |
| **Booking / RDV** | clé tenant | `booking_engine` | ✅ 28 routes · 🔴 non gaté |
| **Marketing** (promos, campagnes) | clé tenant | `marketing_*` | ✅ 27 routes |
| **Générique** (`cml_`) | `cml_` | — | 🟡 préfixe sans générateur de clé |

**Règle d'activation cible** : un moteur n'est **exploitable** (runtime) QUE si le tenant a le service actif dans `tenant_services` OU un abonnement couvrant. Aujourd'hui seul **MEDOS** applique cette règle (`MedosEnabledGuard`). **Cible : un guard générique `EngineEnabledGuard` + décorateur `@RequireEngine('mbolo'|'booking'|'liri'|…)`** sur les contrôleurs, avec fail-open sur erreur DB et bypass `infrastructure_type`.

---

## 5. PARCOURS CLIENT DE BOUT EN BOUT (le produit)

### Étape 1 — Découverte
`cimolace.space` (vitrine) → `/cimolace` (page premium refaite, charte prorascience) → catalogue des OS (`/cimolace/os/:id`). ✅

### Étape 2 — Créer son organisation
- **LIRI self-service** : `/creer-organisation` → `POST /signup/tenant` → login direct → `/liri`. ✅ (CGU corrigées 2026-07-03).
- **École payante** : wizard `/cimolace/admin/.../provision-school`. 🔴 **backend 404** (controller jamais enregistré, 4 méthodes service fantômes). **À livrer (P0)**.

### Étape 3 — Activer un moteur (à la carte)
- Self-service : marketplace `/cimolace/billing?upgrade=…` → `tenant-portal/marketplace/subscribe` → checkout. ✅ souscription.
- Back-office opérateur : fiche client `/cimolace/admin/clients/:id` → onglet Moteurs → toggle `tenant_services`. ✅
- 🔴 **MAIS l'activation ne gate rien au runtime hors MEDOS** → à rendre effective (§4).

### Étape 4 — Payer
- **Stripe** (plateforme + offering + live payant) : signé, prix en DB, chaîne complète. ✅
- **PawaPay** (mobile money) : signé, deposits/refunds/payouts, prouvé E2E (3000 XAF). ✅ · webhooks anti-forge durcis 2026-07-03. ✅
- **Airtel Money** direct : rail livré. 🟡 (creds sandbox).
- **PayPal / Chariow / CinetPay / NowPayments** : stubs. 🔴 → à désactiver (501) tant que non finis.
- Credentials paiement **par tenant** chiffrés AES-256-GCM (le tenant encaisse lui-même). ✅
- 🔴 `offering-checkout` hardcode `isna` → à paramétrer par tenant.

### Étape 5 — Exploiter (hébergé)
Portail LIRI (`/liri`), back-office tenant (`/cimolace/billing`, 14 sections), espace praticien MEDOS. ✅ (rôle décide de la vue ; fail-closed).

### Étape 6 — Embarquer / intégrer sur SON site (le différenciateur)
- **MEDOS** : 3 niveaux (anonyme Origin-whitelist, server-token `mdk_`, SSO praticien handoff). Prouvé live avec zahir-app. ✅
- **LIRI** : SDK v2 + API publique `/v1/liri/*` (clé `lk_live_`) + iframe `/embed/live/:id`. 🟡
- **mbolo** : storefront sous `mbk_`. ✅
- 🔴 **Fragmentation** : 2 conventions de clés (`Bearer cml_/mdk_/mbk_` vs `X-Liri-Api-Key lk_`), 2 secrets JWT embed, 2 SDK sur 2 origines, aucun package npm. **Cible : SDK universel unifié (§6)**.

---

## 6. SDK UNIVERSEL D'INTÉGRATION (cible — Phase D)

**Objectif : une seule façon d'intégrer n'importe quel moteur Cimolace dans n'importe quel site.**

1. **Auth unifiée** : une clé tenant unique `cml_<tenant>_<secret>`, scopée par moteur (`scopes: ['medos:read','mbolo:write','liri:live']`). Un header unique `Authorization: Bearer cml_…`. Générateur de clé + rotation dans le back-office.
2. **Un secret JWT embed**, un issuer, une convention de scopes par mode.
3. **Package npm `@cimolace/sdk`** (versionné) + build UMD `embed.js` (Shadow DOM) servi depuis une origine unique. API : `Cimolace.mount({ engine, mode, container, token })`.
4. **Sécurité embed** : `postMessage` avec `targetOrigin` = origine du parent allowlistée (fin du `'*'`), réception filtrée par origine ; CORS autorisant l'en-tête de clé.
5. **Modes d'intégration** : (A) iframe hébergée, (B) widget script Shadow DOM, (C) API server-to-server (clé jamais exposée navigateur), (D) domaine custom (wildcard + Cloudflare for SaaS).
6. **Docs développeur** : quickstart par moteur, exemples copiables, page `/cimolace/resources/api`.

---

## 7. BACK-OFFICE

- **Opérateur SaaS** (`/cimolace/admin`) : garde `CimolaceStaffGuard` (table `cimolace_staff_members` en RLS, PAS le JWT) ; fiche client 9 onglets réelle ; finances/payouts/wallets. ✅ · 🔴 monitoring simulé + facturation sur tables legacy vides + provisioning école mort + UI staff absente.
- **Client / tenant** (`/cimolace/billing`, 14 sections) : abonnement, moteurs, marketplace, factures, clés API, équipe, webhooks HMAC, MFA. ✅

---

## 8. SÉCURITÉ (cible : tout vert)

- Périmètre HTTP durci (helmet+CSP, HSTS, CORS dynamique `tenant_domains`, ValidationPipe). ✅
- Auth API : JWT vérifié JWKS, guards multi-tenant, clés hashées SHA-256, webhooks Stripe/LiveKit/PawaPay signés. ✅
- **Modèle 100 % applicatif** (API en service-role, RLS bypassée) → *un guard oublié = un trou*. Règle : chaque endpoint mutant porte JwtAuthGuard + TenantGuard + RolesGuard.
- Corrigés 2026-07-03 : bypass paiement PawaPay (webhooks re-lus à la source), IDOR/PHI embed MEDOS, branding sans rôle, toggle legacy sans rôle, cron billing fail-closed, replay IDOR (déjà), escalade privilège `profiles` (trigger).
- Reste (Phase G) : `/dev/*` en prod, postMessage `'*'`, `/auth/tenant-token` sans allowlist de rôle, scoping moteur par préfixe de clé, RLS write `tenant_services`.

---

## 9. FEUILLE DE ROUTE (vagues — état 2026-07-03)

- **Vague 0 — Hygiène** : corriger la carte des repos (mémoire globale + runbooks), bannières OBSOLÈTE, aligner la branche canonique. 🟡
- **Vague 1 — Colmater argent+données** : webhooks PawaPay anti-forge, IDOR PHI, branding/toggle/cron rôles, CGU. ✅ (commit `000ef646`, 2026-07-03).
- **Vague 2 — Rendre le business réel** : gating runtime générique · ressusciter le provisioning école · dé-hardcoder `isna` (offering) · override tenant sur getDepositStatus (✅ brique posée). 🔴
- **Vague 3 — Opérabilité SaaS** : facturation admin sur vraies tables · monitoring réel · route branding admin · UI staff · consolidation double catalogue. 🔴
- **Vague 4 — SDK universel** : clés/scopes unifiés, package `@cimolace/sdk`, sécurité embed, modes A-D, docs dev. 🔴
- **Vague 5 — Preuve** : E2E client complet (activer → org → payer → embarquer) rejoué + ancré en CI ; nettoyage données test en prod. 🔴

---

## 10. RÈGLE DOCUMENTAIRE

UN seul doc canonique daté (celui-ci). Interdiction des « source of truth » auto-proclamées sans date de péremption. Toute décision d'architecture postérieure met à jour CE fichier (section + date), jamais un nouveau doc concurrent.
