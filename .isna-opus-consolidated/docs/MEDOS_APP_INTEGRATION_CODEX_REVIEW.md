# MedOS App Integration — Codex Review

Date : 2026-05-10
Reviewer : Codex
Workspace : `/Users/ngowazulu/Downloads/isna-opus`

---

## Verdict

L'integration MedOS Phase 1A dans `apps/app` est globalement correcte.

Verification executee :

- `npm run build -w @isna/app` : OK
- `npm run build -w @isna/api` : OK
- `npm test -w @isna/api` : OK, 4 suites / 55 tests

Routes frontend ajoutees et confirmees :

- `/dashboard/medos`
- `/dashboard/medos/patients`
- `/dashboard/medos/patients/:id`

Endpoints MedOS consommes :

- `GET /med/patients`
- `POST /med/patients`
- `GET /med/patients/:id`
- `GET /med/patients/:id/notes`
- `POST /med/patients/:id/notes`
- `POST /med/notes/:id/sign`
- `POST /med/notes/:id/share`
- `GET /med/me/notes` expose dans `medosApi`, sans UI patient pour l'instant

La migration Phase 1B est bien neutralisee :

- `supabase/migrations/20260510000008_medos_forms_health.sql.draft`

---

## Point a corriger avant usage client

### P1. Activation MedOS verifiee cote UI seulement

`MedosDashboard` affiche un etat "MedOS non active" si le tenant n'a pas l'infrastructure MedOS ou de moteur MedOS actif.

Mais les routes backend `MedosController` ne verifient pas encore que le tenant possede vraiment MedOS actif.

Risque :

- Un owner/admin d'un tenant non-MedOS pourrait appeler les endpoints MedOS directement si son role est accepte.
- La segmentation produit Cimolace doit etre imposee par le backend, pas seulement par l'interface.

Correction attendue :

- Ajouter un guard ou helper `MedosEnabledGuard`.
- Verifier au serveur :
  - `tenant.infrastructure_type === 'medos'`, ou
  - au moins un `tenant_services.service_key` MedOS actif.
- Appliquer ce guard a toutes les routes `/med/*`.
- Ajouter tests :
  - tenant non-MedOS refuse sur `GET /med/patients`;
  - tenant MedOS autorise;
  - tenant avec moteur MedOS actif autorise.

---

## Points P2

- Le formulaire de creation patient demande `patient_user_id` en texte libre. Acceptable MVP interne, mais il faudra un selecteur utilisateur/invitation patient.
- Le front utilise les routes praticien, pas un vrai portail patient. Conforme au scope.
- `DashboardProduct` contient encore une entree `medos` devenue reference morte. Pas bloquant.

---

## Decision

L'integration front peut rester.

Prochaine micro-tache recommandee :

- securiser l'activation MedOS cote backend avant d'ajouter plus d'ecrans ou de donner acces a un client.

---

## Mise a jour Codex — P1 ferme

Date : 2026-05-10

Correction appliquee directement dans `isna-opus` :

- ajout de `apps/api/src/medos/medos-enabled.guard.ts`;
- application du guard sur les routes Phase 1A :
  - `MedosPatientController`;
  - `MedosNoteController`;
  - `MedosPatientMeController`;
- ajout de `apps/api/src/medos/medos-enabled.guard.spec.ts`.

Comportement valide :

- tenant avec `infrastructure_type = medos` : autorise;
- tenant avec moteur MedOS actif dans `tenant_services` : autorise;
- tenant sans MedOS : refuse;
- erreur DB pendant verification : erreur serveur.

Verification :

- `npm run build -w @isna/api` : OK
- `npm test -w @isna/api` : OK, 5 suites / 60 tests
