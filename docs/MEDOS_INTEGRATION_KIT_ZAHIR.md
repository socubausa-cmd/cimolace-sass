# Kit d'intégration MEDOS — Zahir Wellness

> Objectif : afficher l'**espace santé patient** (dossier, ordonnances, rendez‑vous,
> messagerie, téléconsultation) directement dans **zahirwellness.com**, sans refonte,
> en marque blanche (vos patients ne voient jamais « Cimolace »).

Tout est **déjà actif côté plateforme** : le domaine `zahirwellness.com` est autorisé,
les clés API et les endpoints sont en ligne. Il ne reste qu'à brancher côté Zahir,
au choix selon votre stack.

- **Base API** : `https://api.cimolace.space`
- **Slug tenant** : `zahirwellness`
- **Doc interactive** : https://cimolace.space/medos/integration
- **Démo live** : https://cimolace.space/medos/v1/demo.html

---

## Choisir son mode

| Mode | Pour qui | Effort |
|------|----------|--------|
| **1. Widget JS** | Site vitrine, WordPress, Webflow, page simple | Coller 6 lignes |
| **2. iframe** | CMS qui bloque les scripts tiers | Coller une `<iframe>` |
| **3. API REST (« Mode C »)** | **Zahir** (vous avez déjà votre propre app) | Quelques appels HTTP |

Pour Zahir, qui a déjà une application, le **Mode 3 (API)** est recommandé : vous gardez
votre UI et vos écrans, MEDOS fournit les données et la logique médicale.

---

## Mode 1 — Widget (le plus simple)

Collez ces lignes là où le portail doit apparaître :

```html
<div id="medos-portal"></div>
<script
  src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="zahirwellness"
  data-mode="patient-portal"
  data-primary-color="#0e7a5f"
  async
></script>
```

`data-mode` accepte : `patient-portal`, `appointment-booker`, `consent-form`,
`intake-form`, `health-tracker`.

**Sécurité** : Cimolace vérifie votre domaine via l'en‑tête `Origin` (CORS), délivre un
JWT court (15 min) et applique le RBAC patient. **Aucune clé secrète n'est exposée dans
le navigateur.**

---

## Mode 2 — iframe

```html
<iframe
  src="https://cimolace.space/embed/patient-portal?tenant=zahirwellness"
  style="width:100%;height:760px;border:0;border-radius:14px"
  allow="camera; microphone"
></iframe>
```

(`camera; microphone` nécessaires pour la téléconsultation.)

---

## Mode 3 — API REST (recommandé pour Zahir)

Principe en deux temps :

1. **Votre backend** échange sa **clé API** contre un **embed‑token patient** (court, 15 min).
2. **Votre frontend** appelle les endpoints `/me/*` avec ce token pour lire/écrire les
   données du patient connecté.

La clé API reste **côté serveur** ; seul l'embed‑token (scopé, expirant) circule jusqu'au
navigateur.

### Étape 1 — Émettre un embed‑token (backend → backend)

```bash
curl -X POST https://api.cimolace.space/v1/medos/embed/server-token \
  -H "Authorization: Bearer mdk_zahirwellness_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_email": "patient@exemple.com",
    "mode": "patient-portal",
    "patient_first_name": "Aïcha",
    "patient_last_name": "Demo",
    "external_user_id": "votre-id-interne-optionnel"
  }'
```

Réponse :

```json
{
  "data": {
    "token": "eyJhbGciOi...",        // embed-token patient (15 min)
    "expires_in": 900,
    "api_base": "https://api.cimolace.space",
    "mode": "patient-portal",
    "scope": ["med:appointments:read", "med:prescriptions:read", "..."],
    "patient_user_id": "…",
    "patient_record_id": "…",
    "created": false                  // true si le dossier a été créé à la volée
  }
}
```

> Le patient est rattaché par `patient_email` (créé s'il n'existe pas). Utilisez
> `external_user_id` pour lier au compte de votre app (SSO sans mot de passe Cimolace).

### Étape 2 — Lire / écrire les données patient (frontend → API)

Toutes les requêtes : `Authorization: Bearer <embed-token>` vers
`https://api.cimolace.space/v1/medos/embed/…`

```js
const BASE = "https://api.cimolace.space/v1/medos/embed";
const headers = { Authorization: `Bearer ${embedToken}` };

const rdv     = await fetch(`${BASE}/me/appointments`,  { headers }).then(r => r.json());
const ordo    = await fetch(`${BASE}/me/prescriptions`, { headers }).then(r => r.json());
const notes   = await fetch(`${BASE}/me/notes`,         { headers }).then(r => r.json());
// → { data: [ ... ] }
```

### Endpoints disponibles (mode `patient-portal`)

| Méthode | Endpoint | Scope | Rôle |
|--------:|----------|-------|------|
| GET  | `/me` | `med:me:read` | Profil patient |
| GET  | `/me/appointments` | `med:appointments:read` | Liste des RDV |
| POST | `/me/appointments` | `med:appointments:write` | Réserver un RDV |
| GET  | `/me/prescriptions` | `med:prescriptions:read` | Ordonnances signées |
| GET  | `/me/notes` | `med:notes:read` | Notes de consultation partagées |
| GET  | `/forms` | `med:forms:read` | Formulaires à remplir |
| POST | `/me/forms/:id/submit` | `med:forms:submit` | Soumettre un formulaire |
| GET  | `/me/health` | `med:health:read` | Journal santé (constantes) |
| POST | `/me/health` | `med:health:write` | Ajouter une mesure |
| GET  | `/me/threads` | `med:messages:read` | Fils de messagerie |
| POST | `/me/threads/:id/messages` | `med:messages:write` | Envoyer un message |
| POST | `/me/teleconsult/appointment/:id/join` | `med:teleconsult:join` | Rejoindre une téléconsult |

Enveloppe de réponse standard : `{ "data": ... }`. Erreurs : `{ "error": { "code", "message" } }`.

---

## Récupérer votre clé API

La clé (préfixe `mdk_zahirwellness_…`) est générée côté Cimolace et transmise par canal
sécurisé (jamais par e‑mail en clair). Elle :

- n'est **jamais stockée en clair** (seul son hash SHA‑256) ;
- se **révoque** instantanément en cas de fuite ;
- doit rester **côté serveur** (ne jamais l'exposer dans le bundle navigateur).

---

## Checklist de mise en ligne (côté Zahir)

- [ ] **Mode 1 ou 2** : coller le snippet / l'iframe sur la page voulue. C'est tout.
- [ ] **Mode 3** : stocker la clé API en variable d'environnement serveur ;
      créer une route backend qui appelle `/server-token` ; côté front, appeler `/me/*`
      avec le token reçu.
- [ ] Tester avec un patient pilote, puis ouvrir aux patients.

Domaine déjà autorisé : `zahirwellness.com`, `www.zahirwellness.com`. Pour ajouter
d'autres domaines (staging, app mobile webview), nous les whitelistons à la demande.

---

*Support intégration : l'équipe Cimolace. Cette doc correspond à la version en ligne de
l'API MEDOS (`api.cimolace.space`).*
