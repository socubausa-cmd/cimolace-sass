# MedOS Patient Note Reads — Implementation

Date : 2026-05-11

## Livré

Le portail patient dispose maintenant d'une vraie action backend prévue pour confirmer la lecture d'une note partagée.

## Backend

Migration ajoutée :

- `supabase/migrations/20260511000009_medos_note_reads.sql`

Table :

- `med_note_reads`

But :

- conserver `tenant_id`, `note_id`, `patient_user_id`, `read_at`
- empêcher les doublons via `UNIQUE (tenant_id, note_id, patient_user_id)`
- préparer les notifications et compteurs d'actions patient

Route ajoutée :

- `POST /med/me/notes/:id/read`

Sécurité :

- `JwtAuthGuard`
- `TenantGuard`
- `MedosEnabledGuard`
- `RolesGuard`
- rôle requis : `patient`
- vérifie que le patient connecté possède un dossier dans le tenant
- vérifie que la note appartient à ce dossier
- vérifie que la note est bien partagée au patient
- écrit un audit `read_ack`

La route `GET /med/me/notes` enrichit maintenant les notes avec `patient_read_at` quand la table de lectures existe. Si la migration n'est pas encore appliquée, la liste des notes continue de fonctionner sans casser la démo.

## Frontend

Fichier :

- `apps/app/src/pages/MedosPatientPortal.tsx`

Le bouton `J'ai lu` :

- marque la note comme lue localement immédiatement ;
- appelle `medosApi.markMySharedNoteRead(noteId)` ;
- invalide la query `medos-my-shared-notes` après succès ;
- affiche un message doux si la migration backend n'est pas encore appliquée.

Types/API :

- `MedNote.patient_read_at`
- `medosApi.markMySharedNoteRead(noteId)`

## Validation

- `npm test -w @isna/api -- medos.service.spec.ts` : OK, 37 tests
- `npm run build -w @isna/api` : OK
- `npm run build -w @isna/app` : OK

## Prochaine brique recommandée

Construire `med_patient_notifications` avec les types :

- `note_shared`
- `note_read_required`
- `form_assigned`
- `exam_requested`
- `prescription_available`
- `message_received`

Puis brancher le dashboard patient “Aujourd'hui” sur de vraies notifications.
