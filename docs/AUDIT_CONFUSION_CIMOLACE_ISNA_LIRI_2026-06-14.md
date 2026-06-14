# Audit de cohérence — Cimolace / ISNA / Liri Studio

Date : 2026-06-14
Portée : dossier `isna_platform_v2` (monorepo complet : `apps/api`, `apps/app`, `apps/public-site`, `docs`, `supabase`).
Question posée : *« Le programme respecte-t-il la séparation des produits, ou y a-t-il confusion ? »*

---

## 0. Modèle officiel attendu (rappel)

D'après tes explications et les docs canoniques du repo (`CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md`, `ARCHITECTURE_LIRI_VS_ECOLE.md`) :

```
CIMOLACE = le SaaS parent (la marque, l'OS, le code, le back-office, la facturation)
   │
   ├── MOTEURS (engines, transversaux, activables) :
   │     • Moteur École  (ISNA)   → cours, élèves, profs, formations, bulletins
   │     • Liri Studio   (live)   → live, débat, culte, smartboard — AUTONOME, vendable seul
   │     • MEDOS         (santé)
   │     • Mbolo         (e-commerce)
   │     • Studio Créateur        → suite de création Liri, vendue À PART
   │
   └── TENANTS (clients qui activent des moteurs) :
         ISNA Academy / Prorascience, Zahir, etc.
```

Règles immuables : Cimolace n'est pas un tenant ; un moteur n'est pas un tenant ; tout passe par Cimolace ; **Liri Studio doit pouvoir tourner seul** (modèle Zoom/Stripe : créer une application dans le back-office → récupérer la clé API → installer sur un site existant).

---

## 1. Verdict global

**Partiellement respecté — confusion réelle et structurelle.**

Le **modèle est bien pensé et documenté**, et les briques clés existent (catalogue de moteurs, templates, back-office, SDK Liri autonome, onboarding « infrastructure »). **Mais le code porte encore deux générations de produit superposées** : l'ancienne app « ISNA-Prorascience » (école en dur) et la nouvelle vision « Cimolace multi-moteurs ». Les deux cohabitent sans que l'ancienne ait été retirée — c'est la source principale de la confusion que tu ressens.

Score de conformité estimé : **~55 %**. La vision v2 est codée mais n'a pas remplacé la v1 ; elle s'est ajoutée à côté.

---

## 2. Ce qui est RESPECTÉ ✅

1. **Couche SaaS Cimolace présente.** Modules `cimolace`, `cimolace-catalog`, `cimolace-backoffice` côté API ; pages `apps/app/src/pages/cimolace/admin/*` (clients, sites, billing, support) et `modules/cimolace/*` (subscriptions, contracts, credentials, usage…).
2. **Catalogue de moteurs + templates.** API `/catalog/engines`, `/catalog/templates`, `/catalog/apply-template`, table `tenant_services(tenant_id, service_key, active)`, guards d'activation par moteur. C'est la bonne fondation « activer un moteur pour un tenant ».
3. **Le flux « infrastructure » que tu décris existe déjà** (`docs/CIMOLACE_ONBOARDING_CATALOG_STATUS.md`) : `Onboarding.tsx` → choix d'infrastructure (school / medos / mbolo / wellness / creator / temple / community) → `POST /tenants` → `apply-template` → `/dashboard`, avec `DashboardInfrastructure.tsx` pour « appliquer un autre template ». C'est exactement ton onglet « Mes infrastructures / Créer une autre ».
4. **Liri peut tourner seul.** `apps/app/public/liri-sdk.js` (SDK universel), `apps/api/src/liri-public/` avec `api-key.guard.ts`, tables `tenant_api_keys` / `tenant_domains` (clés + CORS). Le modèle « Zoom-killer installable » est amorcé.
5. **Back-office de gestion tenant fonctionnel.** Services, credentials (références, pas de secrets en clair), billing, sites, diagnostics, attestations de production.

---

## 3. Les CONFUSIONS / non-conformités 🚨

### C1 — « ISNA » : tenant **ou** moteur ? (confusion de vocabulaire racine)
Tu décris ISNA comme **le moteur école multitenant**. Mais le code et la base le traitent comme **un tenant** (un client précis : slug `isna`, domaine `prorascience.org`, contrat, facturation). Le moteur école, lui, porte plusieurs noms différents : module `liri-school`, template `school`, `school_core`, `school-engine-manifest.ts`. Et le **dossier racine s'appelle `isna_platform_v2`**, ce qui fusionne un seul client avec toute la plateforme.
→ **Tant qu'« ISNA » désignera à la fois le client, le moteur et la plateforme, la confusion restera.**

### C2 — Deux coques d'application rivales cohabitent (`App.jsx` vs `App.tsx`)
- `apps/app/src/App.jsx` (**2255 lignes**) = ancienne app **ISNA/Prorascience** ; la racine `/` redirige vers `/t/<DEFAULT_TENANT_SLUG>` et `prorascience.org` est codé en dur.
- `apps/app/src/App.tsx` (**92 lignes**) = nouvelle app **Cimolace v2** propre (Onboarding → infrastructure → dashboards par moteur : `DashboardInfrastructure`, `DashboardLiri`, `MedosDashboard`, `DashboardProduct`…). **C'est le modèle que tu veux.**
- L'entrée réelle `main.tsx` importe `@/App` — **ambigu** : avec `App.jsx` ET `App.tsx` présents, on ne sait pas lequel gagne. Doublon identique côté `main.jsx` (79 l.) / `main.tsx` (20 l.).
→ La vision v2 (`App.tsx`) existe mais **ne pilote pas** réellement l'app ; l'ancienne v1 ISNA est encore là.

### C3 — Liri et École **fusionnés** dans `liri-school`
L'architecture exige que **Liri** (live, smartboard, replay, studio, neuro-recall) soit **horizontal et vendable seul**, séparé de **l'École** (cours, leçons, élèves, profs). Or `apps/app/src/modules/liri-school/` **regroupe les deux** sous un seul module (sous-dossiers : `courses`, `lessons`, `students`, `teachers`, `admin` **ET** `live`, `smartboard`, `replay`, `neuro-recall`, `studio`).
→ Le **nom même « liri-school »** soude les deux produits que tu veux séparer.

### C4 — Identité ISNA codée en dur partout
- **558 fichiers** de `apps/app/src` contiennent l'or ISNA `#D4AF37`.
- **67 fichiers** importent directement `tenants/isna` / `isnaTenantConfig`.
→ Un nouveau tenant créé depuis Cimolace **ne peut pas se débarrasser de l'identité ISNA sans toucher au code**. Le doc `ISNA_PRORASCIENCE_SCHOOL_TENANT_MODEL_AUDIT.md` confirme lui-même que cette migration vers le branding runtime est **inachevée**.

### C5 — L'app par défaut = ISNA, pas Cimolace
Le `SOURCE_OF_TRUTH` exige que `apps/app` atterrisse sur l'admin Cimolace / le resolver tenant. En réalité la coque vivante (`App.jsx`) redirige la racine vers le tenant ISNA et code `prorascience.org`. La doc signale aussi `cimolace.space` rattaché au **mauvais projet Vercel** (`app` au lieu de `public-site`).

### C6 — Plusieurs moteurs live qui se chevauchent
Le back-end contient `live`, `livekit`, `immersive-live`, `zoom-engine`, `smartboard`. L'architecture officielle ne valide que `live` + `livekit`. `zoom-engine` et `immersive-live` ressemblent à des implémentations **parallèles/legacy** du même « moteur live ».
→ Confusion sur **quel est le vrai moteur Liri Studio** canonique.

### C7 — Nombre de moteurs école incohérent (6 vs 11 vs 12)
Le template `school` déclarait **6** moteurs ; le code école expose **12** capacités ; le manifeste corrige à **11**. Trois sources se contredisent (cf. `ISNA_PRORASCIENCE_..._AUDIT.md`).

### C8 — « Studio Créateur » mal délimité
Tu dis : *Studio Créateur regroupe tous les logiciels de création Liri mais ne se vend pas avec Liri Studio.* Dans le code, `studio_creator` est listé comme moteur **recommandé du template école**, et les pages studio vivent sous `liri-school/studio` + `StudioLiri*`.
→ La frontière « Studio Créateur ≠ Liri Studio, vendu à part » **n'est pas matérialisée**.

### C9 — Doublons legacy MEDOS
Le `SOURCE_OF_TRUTH` signale `MedEhrModule`, `MedNotesModule`… qui **doublonnent** `MedosModule` et coexistent encore.

### C10 — Incohérence de facturation ISNA
Tenant ISNA `billing_status = unpaid` alors que les abonnements sont actifs, montants `0 XOF`, `payments` vide. Le statut billing ne reflète pas la réalité contractuelle.

---

## 4. Tableau de synthèse

| # | Confusion | Emplacement | Devrait être | Gravité |
|---|---|---|---|---|
| C1 | ISNA = tenant et moteur et plateforme | nommage global, `isna_platform_v2` | ISNA = **moteur école** ; tenants = clients distincts | 🔴 critique |
| C2 | 2 coques rivales `App.jsx`/`App.tsx` + `main.*` | `apps/app/src/` | 1 seule coque (modèle v2) | 🔴 critique |
| C3 | Liri + École fusionnés | `apps/app/src/modules/liri-school/` | `liri/` (autonome) **+** `school/` | 🔴 critique |
| C4 | Branding ISNA en dur | 558 fichiers `#D4AF37`, 67 imports `tenants/isna` | branding runtime tenant | 🟠 moyenne |
| C5 | App par défaut = ISNA | `App.jsx` racine, `prorascience.org` | défaut = Cimolace / resolver tenant | 🟠 moyenne |
| C6 | Moteurs live qui se chevauchent | `live`, `immersive-live`, `zoom-engine` | un seul moteur Liri Live canonique | 🟠 moyenne |
| C7 | 6 vs 11 vs 12 moteurs école | template vs code vs manifeste | un seul nombre, une seule source | 🟠 moyenne |
| C8 | Studio Créateur non délimité | `liri-school/studio`, `studio_creator` | produit séparé, vendu à part | 🟠 moyenne |
| C9 | Doublons legacy MEDOS | `apps/api/src` Med*Module | seul `MedosModule` | 🟡 faible |
| C10 | Billing ISNA incohérent | DB tenant `isna` | statut aligné au contrat | 🟡 faible |

---

## 5. Plan de travail pour officialiser tout ça

### Phase 0 — Geler le vocabulaire (½ journée, **bloquant**)
Un seul document canonique fixant : **Cimolace** (SaaS) / **Moteur École = ISNA Engine** / **Liri Studio** (live autonome) / **Studio Créateur** (suite création, vendue à part) / **Tenant** (client). Renommer mentalement le repo : `isna_platform_v2` → *« Cimolace Platform »* (le renommage physique du dossier peut venir plus tard).

### Phase 1 — Choisir UNE coque d'app (1–2 jours) — *résout C2, C5*
1. Acter `App.tsx` (modèle v2 infrastructure) comme coque cible.
2. Migrer les routes encore utiles de `App.jsx` vers la structure v2.
3. **Supprimer** `App.jsx` et `main.jsx` (doublons), rendre `@/App` non ambigu.
4. Racine `/` → resolver Cimolace (login / liste tenants), plus de redirection ISNA en dur.

### Phase 2 — Séparer Liri ↔ École (2–4 jours) — *résout C3*
Éclater `modules/liri-school/` en :
- `modules/liri/` → `live`, `smartboard`, `replay`, `studio`, `neuro-recall` (moteur **autonome**, aucune dépendance école).
- `modules/school/` → `courses`, `lessons`, `students`, `teachers`, `admin`, `marketing`, `payments` (vertical qui **consomme** `liri/`).
Règle de lint/CI : interdire tout import `school → liri` inversé (École peut dépendre de Liri, jamais l'inverse).

### Phase 3 — Dé-câbler le branding ISNA (3–5 jours) — *résout C4*
1. Faire consommer partout `useTenantBranding()` + variables `--school-*` (le chantier est commencé, le finir).
2. Remplacer les **558** `#D4AF37` par `var(--school-accent)` (script de codemod + revue).
3. Supprimer les **67** imports directs `tenants/isna` ; ISNA devient une simple config de tenant chargée au runtime, pas une dépendance de code.

### Phase 4 — Un seul moteur live canonique (1–2 jours) — *résout C6*
Décider lequel de `live` / `immersive-live` / `zoom-engine` est **Liri Live officiel**, migrer le reste, archiver les legacy.

### Phase 5 — Réconcilier le catalogue (1 jour) — *résout C7, C8*
1. Source unique = `cimolace-catalog.service.ts`. Aligner template `school`, manifeste et code sur **un seul** jeu de moteurs.
2. Sortir **Studio Créateur** comme produit/engine **séparé** (vendable indépendamment de Liri Studio), pas comme moteur implicite du pack école.

### Phase 6 — Finaliser le back-office « Mes infrastructures » (2–3 jours)
Sur la base de `DashboardInfrastructure.tsx` déjà existant, livrer l'écran que tu décris :
- onglet **« Mes infrastructures »** : liste de toutes les infra créées, avec statut **brouillon / en cours de création / projet fini** ;
- bouton **« Créer une nouvelle infrastructure »** → choix du moteur → template → clé API ;
- **abonnement** : activer, **enregistrer la carte de crédit**, état de paiement par infra ;
- récupération de la **clé API + snippet d'installation** (modèle Zoom/Stripe) pour brancher sur un site existant.

### Phase 7 — Nettoyage technique (1–2 jours) — *résout C9, C10*
Supprimer les `Med*Module` legacy après vérif d'usage ; aligner `billing_status` ISNA sur le contrat réel.

### Phase 8 — Domaines (½ journée)
`cimolace.space` → projet Vercel `public-site` ; `app.cimolace.space` → `app` ; wildcards `*.cimolace.space` et `*.medos.cimolace.space`.

### Phase 9 — Vérification (continue)
Builds API + app, tests catalogue, E2E provisioning école (`scripts/cimolace-provision-school-e2e.mjs`), smoke Cimolace, et **un test qui crée un tenant NON-ISNA et vérifie qu'aucune couleur/identité ISNA n'apparaît** (preuve que la séparation tient).

---

## 6. Ordre de priorité recommandé

1. **Phase 0** (vocabulaire) — sans ça, tout le reste reste flou.
2. **Phase 1 + 2** (une coque + séparer Liri/École) — c'est le cœur de la confusion.
3. **Phase 5 + 6** (catalogue propre + back-office infrastructures) — pour rendre l'offre vendable.
4. **Phase 3** (dé-brander ISNA) — gros volume, peut se faire en parallèle/incrémental.
5. **Phases 4, 7, 8** — consolidation.
6. **Phase 9** — verrouille le tout.

---

*Sources internes : `docs/CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md`, `docs/ARCHITECTURE_LIRI_VS_ECOLE.md`, `docs/ISNA_PRORASCIENCE_SCHOOL_TENANT_MODEL_AUDIT.md`, `docs/CIMOLACE_ONBOARDING_CATALOG_STATUS.md`, code `apps/app/src/`, `apps/api/src/`.*
