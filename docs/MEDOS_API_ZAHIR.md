# MEDOS — Guide d'intégration API (Zahir Wellness)

> **Mode C — Intégration API.** Zahir construit **sa propre interface** (à sa marque, dans son app) et appelle directement l'API MEDOS de Cimolace. Les **données médicales** (patients, RDV, ordonnances, messages, téléconsultation) vivent côté Cimolace, sous le tenant `zahirwellness`, **cloisonnées** de la boutique.

---

## 1. Vue d'ensemble

```
┌─────────────────────┐        server-token (clé API)        ┌──────────────────┐
│  Backend Zahir       │ ───────────────────────────────────▶ │  API Cimolace    │
│  (zahirwellness.com) │ ◀─────────── embed-token (15 min) ─── │  MEDOS           │
└─────────────────────┘                                        └──────────────────┘
          │  transmet l'embed-token au front
          ▼
┌─────────────────────┐        Bearer <embed-token>          ┌──────────────────┐
│  Front Zahir         │ ───────────────────────────────────▶ │  /v1/medos/embed │
│  (UI à la marque)    │ ◀─────────── données patient ─────── │                  │
└─────────────────────┘                                        └──────────────────┘
```

- **Base URL :** `https://api.cimolace.space`
- **Tenant :** `zahirwellness`
- **Clé API :** `mdk_<...>` — **secret, côté backend uniquement**, jamais exposée au navigateur.
- **CORS :** `https://zahirwellness.com` et `https://www.zahirwellness.com` sont autorisés (appels navigateur OK).

---

## 2. Authentification — flux en 2 étapes

### Étape 1 — Backend → embed-token (server-to-server)

Le backend de Zahir échange sa **clé API tenant** + l'identité du patient contre un **embed-token** court (15 min), scopé à ce patient. Crée automatiquement le dossier patient s'il n'existe pas (SSO — pas de re-login).

```http
POST /v1/medos/embed/server-token
Authorization: Bearer mdk_<tenant>_<secret>
Content-Type: application/json

{
  "patient_email": "patient@example.com",
  "patient_first_name": "Sophie",
  "patient_last_name": "Bernard",
  "external_user_id": "ZAHIR_USER_42",
  "mode": "patient-portal"
}
```

**Réponse :**
```json
{
  "token": "eyJhbGciOiJ...",
  "expires_in": 900,
  "api_base": "https://api.cimolace.space",
  "mode": "patient-portal",
  "scope": ["med:me:read", "med:appointments:read", ...],
  "patient_user_id": "c34f5ce8-...",
  "patient_record_id": "06bf9741-...",
  "created": false
}
```

> ⚠️ Le `token` est valable **15 min**. Re-minte-le côté backend à la demande. `patient_user_id` et `patient_record_id` sont **stables** — garde `patient_record_id` (nécessaire pour prendre un RDV).

### Étape 2 — Front → données MEDOS

Le front utilise l'embed-token sur les routes `/v1/medos/embed/*` :
```http
GET /v1/medos/embed/me/appointments
Authorization: Bearer <embed-token>
```

---

## 3. Référence des endpoints (Bearer = embed-token)

| Méthode | Endpoint | Scope requis | Description |
|---|---|---|---|
| GET | `/v1/medos/embed/me/whoami` | — | Vérif intégration (tenant, auth) |
| GET | `/v1/medos/embed/me/appointments` | `med:appointments:read` | Mes rendez-vous |
| POST | `/v1/medos/embed/me/appointments` | `med:appointments:write` | Prendre un RDV |
| GET | `/v1/medos/embed/me/prescriptions` | `med:prescriptions:read` | Mes ordonnances |
| GET | `/v1/medos/embed/me/threads` | `med:messages:read` | Mes conversations |
| GET | `/v1/medos/embed/me/threads/:id/messages` | `med:messages:read` | Messages d'un fil |
| POST | `/v1/medos/embed/me/threads/:id/messages` | `med:messages:write` | Envoyer un message |
| POST | `/v1/medos/embed/me/teleconsult/appointment/:id/join` | `med:teleconsult:join` | Rejoindre la téléconsult (token LiveKit) |
| GET | `/v1/medos/embed/me/notes` | `med:notes:read` | Comptes-rendus partagés |
| POST | `/v1/medos/embed/me/notes/:id/read` | `med:notes:read` | Marquer une note lue |
| GET | `/v1/medos/embed/forms` | `med:forms:read` | Formulaires disponibles |
| GET | `/v1/medos/embed/forms/:id` | `med:forms:read` | Détail d'un formulaire |
| POST | `/v1/medos/embed/me/health` | `med:health:write` | Saisir une mesure santé |

### Exemple — prendre un RDV
```http
POST /v1/medos/embed/me/appointments
Authorization: Bearer <embed-token>
Content-Type: application/json

{
  "patient_id": "<patient_record_id>",   // renvoyé par server-token
  "practitioner_id": "<id praticien>",
  "scheduled_at": "2026-06-10T14:00:00Z",
  "duration_minutes": 30,
  "appointment_type": "teleconsult",       // ou "in_person"
  "reason": "Première consultation"
}
```

### Exemple — rejoindre une téléconsultation
```http
POST /v1/medos/embed/me/teleconsult/appointment/<appointment_id>/join
Authorization: Bearer <embed-token>
{ "displayName": "Sophie B." }
→ { "session_id", "room", "token", "url", "ttl" }   // token + url LiveKit
```

---

## 4. Modes & scopes

Le `mode` passé au server-token détermine les scopes du token :

| Mode | Scopes |
|---|---|
| `patient-portal` | **complet** : me, notes, forms, health, appointments, prescriptions, messages, teleconsult |
| `appointment-booker` | me + appointments (read/write) |
| `health-tracker` | me + health (read/write) |
| `consent-form` / `intake-form` | forms (read/submit) |

➡️ Pour l'espace médical complet de Zahir, utiliser **`patient-portal`**.

---

## 5. Exemple Node (backend Zahir)

```js
// 1. Backend : obtenir un token pour le patient connecté chez Zahir
async function getMedosToken(patient) {
  const r = await fetch("https://api.cimolace.space/v1/medos/embed/server-token", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MEDOS_API_KEY}`, // mdk_...
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_email: patient.email,
      patient_first_name: patient.firstName,
      patient_last_name: patient.lastName,
      external_user_id: patient.id,
      mode: "patient-portal",
    }),
  });
  const { data } = await r.json();          // { token, patient_record_id, ... }
  return data;
}

// 2. Front : utiliser data.token sur /v1/medos/embed/*
```

---

## 6. Sécurité & bonnes pratiques

- **La clé API (`mdk_...`) reste côté serveur.** Ne jamais l'exposer au navigateur.
- L'embed-token (15 min) peut transiter vers le front : il est **scopé au seul patient** et expire vite.
- Toutes les réponses sont enveloppées : `{ "data": ... }`.
- Erreurs : `401` token manquant/expiré · `403` scope manquant · `400` requête invalide.
- Régénérer la clé API : admin Cimolace → *Clés API* du tenant (le secret n'est affiché qu'une fois).

---

*Document généré pour l'intégration MEDOS de Zahir Wellness — API `api.cimolace.space`.*
