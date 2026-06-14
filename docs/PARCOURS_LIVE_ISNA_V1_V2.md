# Parcours LIVE d'une école (ISNA) — scénarios + v1 → v2

> Répond à : « quand un élève prend RDV puis qu'on lance une séance live immersive » et « créer un live programmé pour une formation » — à quel moment on passe par **Portail / Studio / Preparation**, et ce qui était dans **ISNA v1** vs **Cimolace v2**.
> Vérifié sur le code 2026-06-14.

---

## Rappel : Liri est le MOTEUR live (partagé)

`teleconsult.service.ts` (MEDOS) le dit noir sur blanc : *« MEDOS routes ALL video sessions through Liri (LiveService) »*. Donc **toutes les séances vidéo** (école, santé…) passent par le **moteur Liri**. ISNA, Zahir… ne font qu'**activer** ce moteur.

---

## Scénario A — Rendez-vous élève → séance live immersive

**Quand :** un élève réserve un créneau avec un prof ; on transforme ce RDV en séance live (1-à-1 ou petit groupe).

| Étape | Surface / page | Route ou endpoint | Statut v2 |
|---|---|---|---|
| 1. Élève prend RDV | Booking (modals, calendrier) | `POST /booking/appointments` | ✅ v2 |
| 2. Secrétaire/prof **traite le RDV** (prépare, active « Rejoindre ») | `AppointmentPreparationPanel` (rôle secrétaire) | ⚠️ appelle encore `/.netlify/functions/booking-set-preparation` (**v1**) | ⚠️ **à porter** |
| 3. Le RDV devient une **session live** | Santé : `teleconsult.service.create()` (RDV→session Liri) ✅ · École : pont RDV→`immersive_live_sessions` | `POST /immersive-live/livekit/create-room` | ⚠️ **pont école à finaliser** |
| 4. Prof **en live** | **`LiveHostPage`** | `/live/host/:sessionId` | ✅ v2 |
| 5. Élève **rejoint** | **`LiveGuestPage`** | `/live/:sessionId` (token via `/immersive-live/livekit/get-token`) | ✅ v2 |

**Surfaces : ce flux NE passe PAS par le Portail ni le Studio ni LivePreparationStudio.** C'est un RDV → directement la **salle live** (`LiveHostPage`). La « préparation » ici = le **panneau secrétaire** (`AppointmentPreparationPanel`), pas le wizard `LivePreparationStudioPage` (qui sert aux lives de formation).

---

## Scénario B — Créer un live PROGRAMMÉ pour une formation

**Quand :** un prof planifie un cours en live (date, prix, capacité), rattaché à une formation.

| Étape | Surface / page | Route ou endpoint | Statut v2 |
|---|---|---|---|
| 1. Accueil / vue d'ensemble | **Liri Portail** | `/liri` | ✅ |
| 2. Liste des lives | `DashboardLives` | `/dashboard/lives` (`GET /lives`) | ✅ |
| 3. **Créer le live programmé** (titre, `scheduled_at`, prix, capacité) | `DashboardLivesNew` | `/dashboard/lives/new` → `POST /lives` (status `scheduled`) | ✅ |
| 4. (option) **Préparer** le contenu (scènes, smartboard, étapes) | **`LivePreparationStudioPage`** (le wizard) | `/studio/live-preparation/:sessionId` | ✅ |
| 4bis. (option) Créer la formation / les supports | **Studio Liri** | `/studio/liri`, `/studio/liri/formation` | ✅ |
| 5. À l'heure : prof **en live** | **`LiveHostPage`** | `/live/host/:id` = `/studio/live-arena/:id` → `POST /lives/:id/start` | ✅ |
| 6. Élèves **rejoignent** | `LiveGuestPage` | `/live/:id` | ✅ |
| 7. **Après** (replay, post-prod, IA) | `LivePostIntelligencePage` | `/studio/live-post/:id` | ✅ |

**Surfaces : ce flux PASSE par le Portail (entrée), le Studio (création/formation) et LivePreparationStudio (prépa wizard)**, puis la salle live. C'est le parcours « riche ».

---

## À quel moment chaque surface ?

- **Liri Portail** (`/liri`) = **point d'entrée / accueil** des deux scénarios (cockpit, lives à venir).
- **Studio Liri** (`/studio/liri`) + **LivePreparationStudioPage** (`/studio/live-preparation`) = **uniquement le scénario B** (formation) — création de contenu et préparation du live.
- **Le scénario A (RDV) court-circuite Studio/Preparation** : RDV → salle live directe, préparation légère côté secrétaire.
- **LiveHostPage** = la séance, dans **les deux** scénarios (« Arena » = même page).

---

## ISNA v1 (modèle de base) → Cimolace v2

| Capacité | ISNA v1 (Netlify Functions, mono-école) | Cimolace v2 (NestJS multi-tenant) | Reste à faire pour ISNA v2 |
|---|---|---|---|
| Live (séance) | `livekit-create-room.js`, `livekit-get-token.js` | `LiveService` / `ImmersiveLiveService` (REST) | ✅ porté |
| Booking (RDV) | ~18 fonctions `booking-*.js` | `BookingService` + `BookingAdvancedService` | ✅ porté (CRUD) |
| **RDV → live (santé)** | `booking-start-immersive-live.js` | **`teleconsult.service`** (RDV→session Liri) | ✅ porté (MEDOS) |
| **RDV → live (école)** | `booking-start-immersive-live.js` | pont `appointments` confirmé → `immersive_live_sessions` **non finalisé** | ⚠️ **à implémenter** |
| **Préparation RDV (secrétaire)** | `booking-set-preparation.js` | `AppointmentPreparationPanel` **appelle encore la fonction Netlify v1** | ⚠️ **à porter en NestJS** |
| Notifications avant live | `live-start-emails-scheduled.js` (cron) | email-engine / notifications (pas de cron dédié détecté) | ⚠️ à brancher |
| Smartboard live | Edge fn temps réel (`liri-designer-voice-realtime-session`) | Architect Agent (génération avant live) | ➖ variante (acceptable MVP) |
| Replay / post-prod | `replay-augmentation-worker.js` + R2 | `apps/worker` (FFmpeg réel) | ✅ porté |

### Pour « alimenter » ISNA v2 (priorités)

1. **Porter `booking-set-preparation`** (Netlify v1) → endpoint NestJS, et brancher `AppointmentPreparationPanel` dessus (sortir le dernier appel `/.netlify/functions/*`).
2. **Finaliser le pont RDV→live côté école** : quand un `appointments` école passe `confirmed`, créer la session live (réutiliser la logique `teleconsult.service`, déjà OK côté santé).
3. **Notifications avant live** (cron/agent) pour prévenir les élèves.

> Le moteur live (Liri) et le booking sont déjà multi-tenant en v2 ; ce qui manque pour ISNA v2, c'est surtout **les 2 derniers ponts côté école** (préparation secrétaire + RDV→live), la santé (MEDOS) servant déjà de modèle fonctionnel.
