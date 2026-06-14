# Audit ISNA API v1 (modèle autoritaire) → moteur « Liri Booking » pour Cimolace v2

> **ISNA v1** (`~/Downloads/isna_app`, app Vite + **Netlify Functions**, mono-tenant) est le **modèle de référence**. Chaque tenant école de Cimolace v2 doit lui ressembler **au pixel** sur les fonctions école : **messagerie**, **rendez-vous** (création + validation), **moteur de booking intelligent**, **calendrier**.
> **Direction validée :** le moteur de booking intelligent de v1 devient un **moteur embarqué dans Liri** (`liri_booking`) qui traite les rendez-vous + gère le calendrier, et **remplace le moteur générique `calendar`**.
> Audit : 2026-06-14.

---

## 1. Le moteur de booking intelligent v1 (autoritaire)

Cœur : `netlify/functions/_lib/booking/` + ~25 fonctions `booking-*` / `appointments-*` / `secretariat-*`.

### Bibliothèque moteur (`_lib/booking/`)
| Module | Rôle | « Intelligence » |
|---|---|---|
| `availabilityEngine.js` | Calcul des créneaux disponibles | règles d'ouverture + capacité |
| `secretaryMatching.js` | **Recommande le meilleur secrétariat** | **scoring pondéré** : même région +40, en ligne/SLA +30, prime hours +20, charge faible +15, capacité +10 ; fallback local → autre zone → fermé |
| `timezoneRouting.js` | Détecte le contexte visiteur | régions `AF_EU` / `US` / France / Gabon, horaires par région, prime hours |
| `appointmentCreation.js` | Création de rendez-vous | profil garanti, notifications |
| `appointmentNotifications.js` | Notifications RDV | email/relances |
| `immersiveSessionBootstrap.js` | Amorce la session immersive | prépare la room |

### Endpoints (fonctions) — la couverture école complète
- **Création / validation RDV** : `booking-request-appointment`, `booking-confirm-appointment`, `booking-cancel-appointment`, `appointments-book`, `appointments-availability`, `booking-available-slots`, `booking-available-secretaries`, `booking-detect-context`.
- **Reschedule (avec décision staff)** : `booking-reschedule-request`, `-appointment`, `-list-staff`, `-staff-decide`.
- **Relances / satisfaction** : `booking-reminders-scheduled` (cron), `booking-send-reminder`, `booking-satisfaction-send`, `-submit`.
- **Préparation secrétaire** : `booking-set-preparation` (active le bouton « Rejoindre »).
- **Calendrier** : `booking-appointment-ics` (export ICS).
- **Pont RDV → live / chat** : **`booking-start-immersive-live`**, **`booking-start-immersive-chat`**.
- **Secrétariat** : `secretariat-assign-teacher`, `secretariat-invite-student`, `secretariat-process-enrollment`, `secretariat-mark-billing-followup`, `appointments-secretariat-heartbeat`.

### Le pont RDV → live (à répliquer tel quel en v2)
`booking-start-immersive-live.js` : staff fournit `appointmentId` →
1. lit `appointments` (idempotent si `immersive_live_id` déjà set) ;
2. **insère `live_sessions`** : `session_type: 'entretien'`, `visibility_mode: 'secret'`, `scheduled_at` du RDV, `appointment_id` = lien retour, `teacher_id` = staff ;
3. met à jour l'`appointment` avec `immersive_live_id`.
→ Le prof héberge ensuite dans `LiveHostPage`. **C'est exactement ce qui manque côté école v2.**

---

## 2. La messagerie v1 (autoritaire)

Moteur de réponse secrétariat : `response-engine-secretariat-threads` / `-reply`, `response-engine-thread-messages`, table **`conversation_threads`** avec statuts (`escalated`, `qualified`), inbox staff, recherche. Plus mailbox org (`org-mailbox-send`, `mail-imap-sync/scheduled`). C'est une **messagerie qualifiante** (tri/escalade), pas un simple chat.

---

## 3. État Cimolace v2 (NestJS) vs v1

| Capacité v1 (autoritaire) | v2 aujourd'hui | Écart |
|---|---|---|
| Booking CRUD (slots, appointments) | `BookingService` | ✅ porté |
| Reschedule / reminders / satisfaction / ICS | `BookingAdvancedService` | ✅ porté |
| **Secretary matching pondéré** (régions, SLA, charge) | — | ❌ **manquant** |
| **Timezone routing** (contexte visiteur, prime hours) | — | ❌ **manquant** |
| **Pont RDV → live (école)** | `live.service` évoque juste `appointment_id` (commentaire) | ❌ **manquant** (existe côté santé via `teleconsult.service`) |
| **Préparation secrétaire** | front `AppointmentPreparationPanel` appelle encore `/.netlify/functions/booking-set-preparation` (**v1**) | ⚠️ **à porter** |
| **Messagerie qualifiante** (`conversation_threads`, escalade) | `chat-engine` générique | ⚠️ **à enrichir** |
| Calendrier | moteur générique **`calendar`** | ➡️ **à remplacer** (voir §4) |

---

## 4. Cible : moteur `liri_booking` embarqué dans Liri (remplace `calendar`)

Le moteur générique `calendar` est trop pauvre. On le **remplace** par un moteur **`liri_booking`** (catégorie Liri), qui embarque tout le modèle v1 :

- **Rendez-vous** : création, validation, annulation, reschedule (décision staff).
- **Booking intelligent** : `availabilityEngine` + `secretaryMatching` (scoring pondéré) + `timezoneRouting`.
- **Calendrier** : créneaux, ICS, relances programmées, satisfaction.
- **Pont RDV → live** : crée la `live_session` (`entretien`/`secret`) et la relie au RDV — **branché sur le moteur Liri** (comme `teleconsult` côté santé).
- **Préparation secrétaire** : endpoint NestJS (remplace la fonction Netlify v1).

### Impact catalogue
`calendar` est utilisé par les templates **school, wellness, temple, community**. Remplacer `calendar` → `liri_booking` dans ces 4 templates (ou faire de `calendar` un alias de `liri_booking`). À faire prudemment : auditer d'abord tous les usages du `service_key` `'calendar'` (guards, tenant_services) avant le swap.

---

## 5. Plan de portage (pour rendre ISNA v2 « pixel-pixel » avec v1)

1. **Créer le moteur `liri_booking`** côté `apps/api/src` : porter `_lib/booking/` (availabilityEngine, **secretaryMatching**, timezoneRouting, appointmentCreation, notifications) en services NestJS multi-tenant.
2. **Porter le pont RDV → live école** : répliquer `booking-start-immersive-live` (insert `live_sessions` `entretien`/`secret`/`appointment_id`) en réutilisant le `LiveService` (comme `teleconsult.service` le fait déjà côté santé).
3. **Porter `booking-set-preparation`** en endpoint NestJS et rebrancher `AppointmentPreparationPanel` dessus (sortir le dernier appel Netlify v1).
4. **Enrichir la messagerie** : porter le response-engine qualifiant (`conversation_threads`, escalade/qualified) au-dessus de `chat-engine`.
5. **Catalogue** : ajouter `liri_booking`, remplacer `calendar` dans school/wellness/temple/community (après audit des usages de `calendar`).
6. **Notifications avant live** : porter `live-start-emails-scheduled` (cron) → worker/email-engine.

> Côté santé (MEDOS/Zahir), `teleconsult.service` prouve déjà que le pont RDV→live via le moteur Liri fonctionne en v2 — il sert de **modèle d'implémentation** pour le portage côté école.
