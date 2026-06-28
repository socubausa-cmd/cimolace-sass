# 🧭 LIRI vs ISNA — Domaines · Routing · Branding (RÈGLES D'OR)

> **Doc canonique. À lire avant TOUTE tâche touchant : login, redirection après login, branding,
> portail `/liri`, back-office école, ou un lien `/t/:slug`.**
> Objectif : qu'aucun agent ne se reperde sur « c'est LIRI ou ISNA ? c'est quel tenant ? ».
> Complète [REGLES_ARCHITECTURE_CIMOLACE.md](REGLES_ARCHITECTURE_CIMOLACE.md),
> [CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md](CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md),
> [ARCHITECTURE_LIRI_VS_ECOLE.md](ARCHITECTURE_LIRI_VS_ECOLE.md).

---

## 1. Le modèle en 30 secondes

- **Cimolace** = le SaaS (la plateforme, l'équipe, le code).
- **LIRI** = le **PRODUIT** multi-tenant (portail web `apps/app` + app native). Tenant-agnostique.
- **ISNA** = le **1ᵉʳ TENANT** (une école). Son nom commercial = **« Prorascience Academy »**. Son domaine = **`prorascience.org`**.
- ⚠️ **« LIRI Academy » N'EXISTE PAS.** LIRI = le produit ; *Prorascience Academy* = le nom commercial de l'école ISNA qui tourne *sur* LIRI.
- **Analogie** : LIRI = **Shopify** (la plateforme) ; ISNA/Prorascience = **une boutique Shopify** (un marchand). Sur la boutique, on ne voit pas « Shopify ».

---

## 2. 🥇 RÈGLE D'OR : **le DOMAINE décide de tout** (branding + tenant)

Hook unique : `isPlatformOrDevHost(hostname)` (`src/lib/tenantResolver.js`).

| Domaine | `isPlatformOrDevHost` | C'est… | Marque affichée | Tenant résolu |
|---|---|---|---|---|
| `liri.cimolace.space`, `app.cimolace.space`, `*.cimolace.space`, `localhost` | **true** (plateforme) | Le **PRODUIT LIRI** neutre | **« LIRI »** (+ « · {école de session} » en suffixe) | celui de la **session** (JWT / `authStore`) |
| `prorascience.org` (et tout domaine custom de tenant) | **false** (domaine tenant) | L'**instance du tenant** (ISNA) | **« Prorascience »** — **JAMAIS « LIRI »** | résolu par le **domaine** (`tenant_domains`) |

➡️ **`prorascience.org` ne doit JAMAIS afficher le mot « LIRI » ni le logo LIRI** (ni au login, ni dans le back-office, ni dans le portail). LIRI y est le moteur **invisible**.
➡️ Sur `liri.cimolace.space`, la marque reste « LIRI » MAIS les **données** = le tenant de la session (ex. un owner ISNA y voit ses données isna, bandeau « LIRI · Prorascience »).

---

## 3. Login & redirection après connexion

### Les 3 pages de login (ne pas les confondre)
| Route | Quoi | Branding |
|---|---|---|
| `/login` | Login **produit LIRI** | par DOMAINE : « LIRI » sur plateforme, tenant sur `prorascience.org` (`isPlatformLiri = isPlatformOrDevHost(host) && !tenantCtx.slug` dans `LoginPage.jsx`) |
| `/t/:tenantSlug/login` | Login **école spécifique** (`SchoolLoginPage.jsx`) | toujours le tenant |
| `/cimolace/login` | Back-office **SaaS Cimolace** | Cimolace |

### Après login (`DashboardRedirect` dans `App.jsx`, + `resolveDashboardPath` dans `lib/dashboardRoute.js`)
- `role = owner/admin` → **`/liri`** si **hôte plateforme**, sinon **`/owner-dashboard`** (back-office École, brandé tenant).
- Le routing est **conscient du domaine** : `isPlatformOrDevHost(window.location.hostname)`.

### `/liri` vs `/owner-dashboard` — DEUX choses différentes
| | `/liri` = `LiriPortalPage` | `/owner-dashboard` = `OwnerDashboard` |
|---|---|---|
| C'est | Le **portail PRODUIT LIRI** (hub façon Zoom : Démarrer/Lives/Studio/**École**/Biblio/Brain…) | Le **moteur ÉCOLE** (cours, élèves, parcours…) |
| Le moteur École est… | **un onglet** du portail | la chose elle-même |
| Header global | **aucun** (shell propre, dans `hideHeaderRoutes`) | aucun (le Header vitrine y était la cause de « ça me ramène à la vitrine » → retiré) |

---

## 4. 🚫 Anti-fuite ISNA (la dette qui fait se reperdre)

**Ne JAMAIS coder `isna` en dur dans un lien, un slug d'action, un id, ou du branding du produit.**

| Au lieu de… | Utiliser… | Source |
|---|---|---|
| `'/t/isna/...'` en dur | `` `/t/${getActiveTenantSlug()}/...` `` | `lib/tenant/activeBranding.js` |
| `getActiveTenantSlug() \|\| 'isna'` | **`resolveTenantSlug()`** (slug résolu sinon domaine, jamais isna) | `lib/tenant/activeBranding.js` |
| `tenant_id = ISNA_TENANT_ID` | `getActiveTenantId()` (sinon RLS — fail-closed) | `lib/tenant/activeBranding.js` |
| presets/rôles/modules ISNA en dur | données **réelles du tenant** (`courses`, `tenant_memberships`) scopées RLS | DB |

**Légitime (NE PAS toucher)** : `tenants/isna/tenant.config.js`, `FOUNDER_TENANT_CONFIG`, vitrine narrative `/t/isna/{ecole,temple,fondateur,doctrine}`, `Header.jsx` gate `ISNA_SLUG` (vitrine isna), un produit **réservé à isna** gardé derrière `getActiveTenantSlug() === 'isna'` (ex. consultation « Ngowazulu » dans `StudentOfferHub`).

---

## 5. 🎨 Shell chaud du portail LIRI (couleurs)

Le portail (`LiriPortalShell` + `LiriPortal.css`, classe racine `.lp-root` / `.lp-shell-main`) est **chaud** :
`--base #262624`, `--rail #1f1e1c`, `--panel #30302e`, **accent coral `--coral #d97757`**.
- **Pas de halo bleu-nuit / aurora or-navy** dans le portail : le forum (`.forum-bg`) et la messagerie sont re-thémés en `#262624` + mesh coral discret **dans le portail uniquement** (`.lp-shell-main …`), l'espace élève garde ses ambiances.
- Le `<main>` du portail + les conteneurs de contenu portent un **fond opaque chaud** (sinon le glow coral transparaît = « halo marron »).
- `--school-accent: #d97757` est posé sur `.lp-shell-main` → bulles messagerie / onglets / liens passent de l'or ISNA au **coral** dans le portail.
- Messagerie = `MessagingPage embedded` = déjà **façon WhatsApp** (header conversation, bulles asymétriques, coches ✓✓ `CheckCheck`, motif de fond, typing, statut en ligne). Cf. [live-shell-theming](#) (mémoire).

---

## 6. Fichiers clés (la carte)

- `src/lib/tenantResolver.js` — `isPlatformOrDevHost`, `getCachedHostTenant` (résolution host→tenant).
- `src/lib/tenant/activeBranding.js` — `getActiveTenantSlug/Id`, `resolveTenantSlug`, `getActiveTenantBranding` (accesseurs synchrones).
- `src/lib/tenant/activeTenantConfig.js` — seam résolu par hôte (`activeTenantConfig` neutre LIRI sur plateforme, ISNA sur son domaine) + `FOUNDER_TENANT_CONFIG` (ISNA littéral).
- `src/pages/LoginPage.jsx` — login produit (branding par domaine).
- `src/App.jsx` — `DashboardRedirect`, `RootRedirect`, `hideHeaderRoutes`.
- `src/components/liri/LiriPortalShell.tsx` + `src/pages/LiriPortal.css` — chrome + thème chaud du portail.
- `src/pages/MessagingPage.jsx` (mode `embedded`) — messagerie WhatsApp.

---

## 7. Historique (2026-06-28) — ce qui a été tranché et corrigé

1. **Séparation par domaine** : login + redirect conscients du domaine ; back-office École sans bandeau vitrine ; logo LIRI masqué sur domaine tenant. (`prorascience.org` ≠ `liri.cimolace.space`, prouvé live.)
2. **Audit fuites portail LIRI** : `/t/isna/live`, branding « Prorascience » mobile, `orgSlug` fallback localStorage, modules `Step5Inviter`, rôles `ROLE_OPTIONS`, présentateur smartboard « Manikongo » → tous éliminés / rendus dynamiques.
3. **Sidebar prof** : liens admin scopés au tenant (`buildAdminNav(getActiveTenantSlug())`).
4. **Espace élève / forfaits** : `resolveTenantSlug()` partout ; produit « Ngowazulu » gardé à isna.
5. **UI portail** : halo marron calmé (shell chaud `#262624`), messagerie façon WhatsApp, bandeau **« LIRI · {école de session} »** sur l'hôte plateforme.

> ⚠️ Anomalie connue tolérée : `.lp-shell-main` (le `<main>` du portail) calcule un `backgroundColor:transparent` même avec un fond défini (cause non élucidée, aucune règle CSS coupable trouvée). Contournée en donnant le fond chaud directement aux conteneurs de contenu (forum + messagerie).
