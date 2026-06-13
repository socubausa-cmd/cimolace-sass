# Architecture Cimolace — SaaS, Produits, Tenants & Routes

> **Document officiel de référence.** À lire avant toute évolution touchant aux routes,
> au multi-tenant, à l'authentification ou à l'onboarding d'un client.
> But : **arrêter la confusion entre Cimolace (le SaaS) et ses tenants** (en particulier ISNA).

---

## 1. Le modèle en une phrase

**Cimolace est un SaaS.** Un client s'inscrit sur Cimolace, puis crée **sa** plateforme en
activant un ou plusieurs **produits** (École, Boutique mbolo, LIRI Live Room, MEDOS…).
Chaque client est un **tenant**. **ISNA est simplement le premier tenant** (une école) ;
il a son propre domaine personnalisé **prorascience.org**.

```
Cimolace (SaaS, propriétaire = Ngowazulu / cimolace@gmail.com)
│
├── Catalogue de PRODUITS / MOTEURS (ce que Cimolace vend)
│     • LIRI School Engine™      (moteur d'école — le « modèle ISNA »)
│     • LIRI Live Room™          (visioconférence immersive — concurrent Zoom)
│     • LIRI Creator Studio™     (création de cours/SmartBoard/vidéo)
│     • LIRI Admin Booking™      (réservation / calendrier / secrétariat)
│     • Virtuel-Mbolo™           (boutique e-commerce)
│     • MEDOS                    (médical : téléconsult, dossier patient)
│     • LIRI Marketing Creator™  (marketing/ads)
│
└── TENANTS (les clients qui souscrivent à des produits)
      ├── isna     → école, domaine perso prorascience.org   ← 1er client
      ├── zahir    → MEDOS + mbolo (zahirwellness.com)
      └── …        → chaque nouveau client = nouveau tenant
```

**Règle d'or : `isna` ≠ Cimolace.** `isna` est une *valeur de donnée* (un slug de tenant),
pas une constante de plateforme. Rien de spécifique à ISNA ne doit être codé en dur dans le
cœur applicatif — tout passe par la **résolution de tenant** (slug d'URL, domaine, config).

---

## 2. Cimolace = la plateforme SaaS

| | |
|---|---|
| **Rôle** | Couche infra/SaaS invisible (comme Stripe/Zoom en coulisses) qui héberge et facture les moteurs. |
| **Propriétaire** | `cimolace@gmail.com` (Ngowazulu). Opérateur = ligne dans `cimolace_staff_members` (≠ JWT). |
| **API (control plane)** | `apps/api` (NestJS), sert `api.cimolace.space` (Railway). |
| **App (back-office)** | `apps/app` (React/Vite), sert `app.cimolace.space` (Vercel). |
| **DB** | Supabase multi-tenant `fwfupxvmwtxbtbjdeqvu` : `tenants`, `tenant_memberships`, `tenant_api_keys` (`cml_`/`mdk_`/`mbk_`), `tenant_services`, `billing_plans`, `billing_subscriptions`, `tenant_domains`. |

### Deux back-offices Cimolace (tous deux sous `/cimolace/*`)
- **Propriétaire du SaaS** → `/cimolace/admin/*` (garde `CimolaceProtectedOwnerRoute` →
  `cimolace_staff_members`). Gère les clients, moteurs, facturation, monitoring, tickets.
- **Client / tenant (self-service)** → `/cimolace/login` → `/cimolace/billing`
  (14 sections : abonnement, marketplace, moteurs, clés API, équipe, webhooks…) +
  `/cimolace/solutions` (catalogue des produits à activer).

---

## 3. Les produits / moteurs

Catalogue défini dans **`apps/app/src/pages/CimolaceSolutionsPage.jsx`** (route `/cimolace/solutions`).
Côté école, le détail des moteurs activables vit dans
**`apps/api/src/cimolace-backoffice/school-engine-manifest.ts`** (`SCHOOL_ENGINE_MANIFEST`).

| Produit (`id`) | Ce que c'est | Surfaces / routes principales |
|---|---|---|
| `school-engine` | **Moteur d'école** (parcours, cours, certification) — le « modèle ISNA » | `/t/:slug/admin/*`, `/studio/*` |
| `live-room` | **LIRI Live Room** — visio immersive (LiveKit, SmartBoard, débat, NeuroRecall) | `/studio/live-arena/:id` (hôte), `/live/:id` (invité), `/m/eleve/live` |
| `creator-studio` | Studio de création (SmartBoard Designer, Formation Builder, post-prod) | `/studio/*` |
| `admin-booking` | Réservation / calendrier / secrétariat | `/t/:slug/admin` (booking), `/studio/appointment` |
| `mbolo` | **Boutique e-commerce** | API `mbk_`, repo `~/Projects/mbolo` (storefront) |
| `medos` | **Médical** (téléconsult, portail patient) | `apps/med-app`, `apps/patient-portal`, API `mdk_` |
| `marketing-creator` | Marketing / ads | `/studio/ad-creator` |

**Activation d'un produit pour un tenant** (pas de hardcode) :
- `tenant_services` (active/settings par moteur) — piloté depuis le back-office.
- `tenant_api_keys` par moteur : `cml_` (générique), `mdk_` (MEDOS), `mbk_` (mbolo).
- `billing_subscriptions` (abonnement actif) + gating `tenants.metadata.billing.api_gating`
  (→ 402 si pas d'abo, cf. `apps/api/src/auth/api-key.guard.ts`).

---

## 4. Les tenants (clients)

Un tenant = une ligne dans `tenants` + des membres dans `tenant_memberships` + (optionnel)
un ou plusieurs **domaines** dans `tenant_domains`.

- **Config tenant front** : `apps/app/src/tenants/<slug>/tenant.config.js`
  (id, slug, name, `features`, `branding` dont `publicSiteOrigin`). Ex. `tenants/isna/tenant.config.js`.
- **ISNA = 1er tenant** : `slug='isna'`, id `4f6faaa8-43a0-46d6-b98a-99ea1154f9ea`,
  école « Institut Supérieur de Nutrition Alimentaire », **domaine perso `prorascience.org`**.
  ISNA a un **compte Cimolace** (back-office `/cimolace/billing`) pour gérer son abonnement et payer.
- **Domaines** : `tenant_domains` (`usage='custom_host'` pour le domaine perso, `embed_origin`
  pour les widgets). C'est la **source de vérité** des domaines — utilisée pour le CORS dynamique,
  le routage apex→tenant, et le retour OAuth (cf. §6).

---

## 5. Taxonomie des routes (le point « pour que les routes ne s'embrouillent pas »)

Quatre familles, **ne pas les mélanger** :

### A. `/cimolace/*` — la PLATEFORME SaaS (Cimolace lui-même)
- `/cimolace/login` — connexion (opérateur **ou** client).
- `/cimolace/admin/*` — back-office **propriétaire** (gestion de tous les clients).
- `/cimolace/billing` — back-office **client/tenant** (son abonnement, ses moteurs, ses clés).
- `/cimolace/solutions` — catalogue des produits à activer.

### B. `/t/:tenantSlug/*` — l'UI d'un TENANT (le moteur rendu pour ce client)
- `/t/:slug` — vitrine publique du tenant · `/t/:slug/login` · `/t/:slug/signup`
  · `/t/:slug/auth/callback` (OAuth) · `/t/:slug/courses` · `/t/:slug/paiement`.
- `/t/:slug/admin/*` — back-office **école** du tenant (dashboard, cours, élèves, parcours,
  facturation école, réglages). Garde `TenantProtectedRoute`.
- ⚠️ **Paramétré par `:tenantSlug`** — ces routes sont multi-tenant **sauf** les exceptions ISNA en dur (cf. §7).

### C. Routes PRODUIT / MOTEUR (transverses, pas sous `/t/`)
- `/studio/*` — création (LIRI Creator Studio + hôte live `/studio/live-arena/:id`).
- `/live/:id`, `/live/host/:id`, `/live/phone`, `/live/mobile-camera`, `/embed/live/:id` — LIRI Live Room.
- `/m/eleve/*` — app élève mobile (LIRI).
- `/dashboard/liri` — LIRI Brain. `/owner-dashboard` — espace propriétaire d'une école.

### D. Routage par DOMAINE (`apps/app/src/App.jsx`, `RootRedirect` / `CimolaceDomainHandler`)
- `cimolace.space` / `app.cimolace.space` → `/cimolace/*` (la plateforme).
- **Domaine perso d'un tenant** (ex. `prorascience.org`) → la vitrine du tenant (`/t/:slug`).
- `*.prorascience.org` (sous-domaine réservé exclu) → `/t/:slug/admin`.
- localhost / `*.local` → pas de forçage (dev).

> Mnémonique : **`/cimolace` = le SaaS** · **`/t/:slug` = un client** · **`/studio` `/live` `/m/eleve` = les moteurs** · **le domaine décide du tenant**.

---

## 6. Authentification Google multi-tenant (rappel)

Conçue pour être **scalable sans config par tenant** (cf. PR #14 / `docs`/edge functions
`oauth-initiate` + `oauth-callback`) : Google ne connaît **qu'une seule URI fixe**
(`…/functions/v1/oauth-callback`) ; la fonction relaie le retour vers **le domaine du tenant**
(lu dans `tenant_domains`). → **Aucune URL à ajouter manuellement dans Supabase pour chaque
nouveau client.** Ne jamais revenir à un flux qui exige d'allowlister chaque domaine.

---

## 7. ⚠️ Dette : hardcodings « isna » à généraliser

`isna` est traité comme défaut implicite à plusieurs endroits du cœur applicatif. Ce sont des
**points de couplage à éliminer** pour onboarder un nouveau tenant sans toucher au code.

| Endroit (chemin:ligne) | Problème | Correctif cible |
|---|---|---|
| `App.jsx` `const TENANT_SLUG = 'isna'` (+ `TENANT_*_PATH`) | tenant par défaut codé en dur | `DEFAULT_TENANT_SLUG` configurable (`VITE_DEFAULT_TENANT_SLUG`), résolu par domaine |
| `lib/auth-store.ts` (`/prorascience`, `/m/eleve`, `/student-school-life`, `/cimolace`… → `'isna'`) | fallback tenant = `'isna'` en dur | mapping `domaine → tenant` (table `tenant_domains`) + défaut configurable |
| `App.jsx` routes exactes `/t/isna`, `/t/isna/ecole|temple|programme|mission|fondateur|doctrine` (`MaquetteHero04`…) | vitrine narrative ISNA montée sur des chemins en dur | route générique `/t/:slug` qui charge la vitrine **depuis la config/DB du tenant** (le **contenu** ISNA reste à ISNA, le **chemin** devient générique) |
| `lib/auth-store.ts` `TOKEN_KEY='isna-v2-debug-api-bearer'`, `TENANT_KEY='isna-v2-tenant-slug'` | clés localStorage préfixées `isna` | préfixe neutre `cimolace-…` (compat à gérer) |
| Fallbacks `localStorage.getItem('tenantSlug') \|\| 'isna'` (Forum, etc.) | défaut `'isna'` | `DEFAULT_TENANT_SLUG` central |
| `StudioIsnaPipelinePage.jsx` table `isna_pipeline_runs` | table nommée par tenant | table générique scopée `tenant_id` |
| `apps/app/src/app/isna/*` (Next legacy) | pages `/app/isna/*` | redirections legacy — à supprimer à terme |

**Légitimes (NE PAS toucher)** : `tenants/isna/tenant.config.js` (données du tenant ISNA),
le **contenu** des pages `Maquette*` (vitrine ISNA), `prorascience.org` comme domaine d'ISNA,
les assets `/image-pro/prorascience-*`, l'email de dev `cimolace-admin@prorascience.local`.

### Plan de généralisation suggéré (ordre, du plus sûr au plus impactant)
1. Centraliser le défaut : `apps/app/src/config/platform.js` →
   `export const DEFAULT_TENANT_SLUG = import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'isna';`
   puis remplacer les littéraux `'isna'` de fallback par cette constante. (Sûr, pas de changement de comportement.)
2. Résoudre le tenant **par domaine** via `tenant_domains` (au lieu des `if path.includes('prorascience')`).
3. Rendre la vitrine `/t/:slug` générique (charger `Maquette*`/contenu depuis la config tenant)
   et faire pointer l'apex du domaine perso dessus, en gardant le rendu actuel pour ISNA.
4. Nettoyer les routes/redirections legacy `/app/isna/*`, `/isna/*`, `/ecoles/isna-*`.

> ⚠️ Plusieurs de ces points sont **load-bearing en prod** (prorascience.org est servi via
> `/t/isna`). À faire en chantier dédié, branche + revue, pas en sweep aveugle.

---

## 8. Repères repos (écosystème)
- **Control plane / API + back-office** : `~/Downloads/isna_platform_v2` (ce repo).
- **mbolo** : `~/Projects/mbolo` (storefront e-commerce réutilisable, clé `mbk_`).
- **zahirwellness.com** : `~/Projects/zahirwellness-main` (tenant MEDOS + mbolo).
- **App mobile LIRI** : `apps/mobile` (Expo) — install isolé hors workspaces.
