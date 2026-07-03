# @cimolace/sdk — SDK universel d'intégration

Embarquez **n'importe quel moteur Cimolace** (LIRI live, MEDOS, mbolo…) dans
**n'importe quel site**, avec une seule API. Remplace les SDK fragmentés
(`liri-sdk.js` + `medos/v1/embed.js`) par une convention unique et un
`postMessage` sécurisé (origine vérifiée).

> Réf produit : `docs/CAHIER_DE_CHARGE_CIMOLACE.md` §6.

## Installation

**Script tag (le plus simple, aucun build) :**

```html
<script src="https://app.cimolace.space/sdk/cimolace-sdk.js" defer></script>
```

> Servi en statique par le front (`apps/app/public/sdk/cimolace-sdk.js`, même
> mécanisme que `liri-sdk.js`). La source canonique reste `packages/sdk/cimolace-sdk.js` ;
> la copie `public/` doit rester synchronisée (identiques).

**npm (bundlers) :**

```bash
npm install @cimolace/sdk
```

```js
import Cimolace from '@cimolace/sdk';
```

## Utilisation

### 1. Auto-mount déclaratif (data-attributs)

```html
<!-- Un live LIRI -->
<div data-cimolace-engine="liri" data-tenant="mon-ecole" data-live-id="abc-123" data-height="640"></div>

<!-- La boutique mbolo -->
<div data-cimolace-engine="mbolo" data-tenant="ma-boutique"></div>

<!-- Le portail patient MEDOS (token émis par VOTRE serveur) -->
<div data-cimolace-engine="medos" data-tenant="ma-clinique" data-mode="patient-portal" data-token="…"></div>
```

Le SDK monte automatiquement chaque `[data-cimolace-engine]` au chargement.

### 2. Programmatique

```js
const live = Cimolace.mount({
  engine: 'liri',
  container: '#live',        // sélecteur ou élément DOM
  tenant: 'mon-ecole',
  liveId: 'abc-123',
  height: 640,
  theme: 'dark',
  onEvent: (msg) => console.log('événement moteur', msg),
});

// … plus tard
live.post('mute', { on: true }); // message vers l'iframe (origine ciblée, jamais '*')
live.unmount();
```

## Moteurs disponibles

| `engine` | Options requises | Statut | Surface réelle |
|---|---|---|---|
| `liri`  | `tenant`, `liveId` | ✅ ready | iframe `/embed/live/:id` (+ `/embed/studio`) |
| `medos` | `token` (code SSO minté serveur) | ✅ ready | handoff SSO `med.cimolace.space/handoff?code=…` |
| `mbolo` | `tenant` | ✅ ready | iframe `/embed/boutique?tenant=…` → catalogue public `GET /v1/mbolo/embed/:slug/catalog` |

- **MEDOS** : le `token` est un **code SSO à usage unique** que VOTRE backend mint via `POST /v1/medos/embed/practitioner-token` (clé `mdk_`). La clé API n'est jamais exposée au navigateur.
- **mbolo** : catalogue **public** par slug (produits/catégories actifs + branding) — **aucune clé exposée** au navigateur. `option.category` filtre par catégorie. Le clic sur un produit ouvre la boutique hébergée (panier/checkout gardés). L'iframe remonte sa hauteur au parent (`postMessage {type:'resize'}`).

`Cimolace.engines` liste les moteurs à l'exécution ; chaque entrée porte un `status` (`ready`/`preview`).

## Sécurité

- **Ne jamais exposer une clé API `cml_…` dans un site public.** Pour les modes
  identifiés (dossier d'un patient précis, panier serveur), votre backend
  détient la clé, appelle Cimolace et fournit au SDK un **`token` court**.
- Les modes anonymes (live public, storefront) s'authentifient par **Origin**
  (domaine autorisé côté tenant), sans clé.
- Le `postMessage` entre l'iframe et l'hôte est **filtré par origine** dans les
  deux sens (jamais de `targetOrigin: '*'`).

## Cible (backend, prochaine étape)

Aujourd'hui chaque moteur garde sa convention d'auth serveur (`mdk_`, `mbk_`,
`lk_live_`). La cible §6 du cahier de charge est **une clé unique `cml_<tenant>_<secret>`
scopée par moteur** (`scopes: ['liri:live','medos:read',…]`) + un secret JWT embed
unique + le service de ce SDK sur une origine unique (`/sdk/cimolace-sdk.js`).
Le présent SDK expose déjà l'API cliente unifiée ; l'unification côté serveur suit.
