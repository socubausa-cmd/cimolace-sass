# MedOS Phase 1A — Codex Review

Date : 2026-05-10
Reviewer : Codex
Workspace : `/Users/ngowazulu/Downloads/isna-opus`

---

## Verdict

DeepSeek V4 Pro a bien cree un premier socle MedOS dans `isna-opus`.

Acceptation : **partielle**.

Le module est present, compile, et les tests unitaires passent. Mais il reste des corrections P1 avant de considerer MedOS comme base medicale livrable ou avant de brancher une UI client.

Verification executee :

- `npm run build -w @isna/api` : OK
- `npm test -w @isna/api` : OK, 4 suites / 40 tests

---

## Ce qui est confirme

- Module cree : `apps/api/src/medos`
- Migration creee : `supabase/migrations/20260510000007_medos_core.sql`
- Tables creees :
  - `med_patients`
  - `med_consultation_notes`
  - `med_audit_log`
- Controllers proteges par `JwtAuthGuard` + `TenantGuard`
- Mutations protegees par `RolesGuard`
- Patient ne peut pas lister tous les patients via API
- Receptionist ne peut pas acceder aux notes cliniques via API
- Notes signees bloquees contre update via service
- Tests unitaires ajoutes
- Scaffolds frontend ajoutes :
  - `apps/med-app`
  - `apps/patient-portal`

---

## Findings P1

### P1. Audit log non obligatoire en pratique

Fichier : `apps/api/src/medos/medos.service.ts`
Zone : `writeAudit()`

Le commentaire annonce un audit obligatoire, mais si l'insertion dans `med_audit_log` echoue, le service log l'erreur et laisse l'operation principale reussir.

Risque : creation/modification medicale sans trace d'audit, ce qui contredit l'exigence MedOS Phase 1A.

Correction attendue :

- Pour les mutations medicales, l'echec audit doit bloquer l'operation ou utiliser une strategie transactionnelle explicite.
- Au minimum, retourner une erreur serveur si audit insert echoue.
- Ajouter test : mutation refusee si audit log echoue.

### P1. `signNote()` peut resigner une note deja signee

Fichier : `apps/api/src/medos/medos.service.ts`
Zone : `signNote()`

`updateNote()` verifie `is_signed`, mais `signNote()` fait directement un update sans verifier l'etat actuel.

Risque : signature remplacee silencieusement, `signed_at` ecrase, audit incoherent.

Correction attendue :

- Fetch note par `tenant_id + id`.
- Si introuvable : 404.
- Si `is_signed = true` : 400.
- Sinon signer.
- Ajouter test : signer deux fois retourne 400 et ne modifie pas `signed_at`.

### P1. RLS audit insert trop large

Fichier : `supabase/migrations/20260510000007_medos_core.sql`
Zone : policy `service_insert_audit`

La policy `FOR INSERT WITH CHECK (true)` n'est pas explicitement limitee a `service_role`.

Risque : selon les privileges Supabase/PostgREST, tout role ayant le droit INSERT pourrait ecrire des logs falsifies.

Correction attendue :

- Changer en policy explicite `TO service_role`.
- Idealement refuser update/delete sur `med_audit_log` pour rendre l'audit append-only.
- Ajouter verification SQL/documentee.

---

## Findings P2

### P2. DTO arrays valides comme object

Fichiers :

- `apps/api/src/medos/dto/create-patient.dto.ts`
- `apps/api/src/medos/dto/update-patient.dto.ts`
- `apps/api/src/medos/dto/create-note.dto.ts`
- `apps/api/src/medos/dto/update-note.dto.ts`

Des champs declares en tableaux (`allergies`, `chronic_conditions`, `current_medications`, `icd10_codes`) utilisent `@IsObject()`.

Risque : validation incorrecte ou rejet de payloads normaux.

Correction attendue :

- Utiliser `@IsArray()` pour les tableaux.
- Ajouter `@ValidateNested({ each: true })` + DTO enfants si possible.
- Ajouter tests de validation DTO via controller/e2e ou pipe.

### P2. Portail patient appelle une route interdite aux patients

Fichiers :

- `apps/patient-portal/src/lib/api.ts`
- `apps/api/src/medos/medos.controller.ts`

Le portail patient appelle `GET /med/patients/:id/notes`, mais cette route est limitee a owner/practitioner/clinic_admin. La RLS SQL prevoit les notes partagees, mais l'API ne fournit pas encore de route patient pour les lire.

Correction attendue :

- Ajouter endpoint patient dedie, par exemple `GET /med/patient/me/notes`.
- Ne pas demander au patient de connaitre son `patient_id`.
- Retourner seulement les notes `is_shared_with_patient = true`.

### P2. Frontend ajoute hors perimetre Phase 1A

DeepSeek a cree `apps/med-app` et `apps/patient-portal`, alors que le prompt demandait de ne pas faire le portail patient dans cette phase.

Impact faible pour l'instant : ce sont des scaffolds simples, mais ils ne doivent pas etre presentes comme livrables.

Decision : les garder comme brouillons si non genants, mais ne pas construire dessus avant correction des P1 backend.

### P2. Artefacts de build visibles

Des artefacts existent :

- `apps/med-app/dist`
- `apps/med-app/tsconfig.tsbuildinfo`
- `apps/patient-portal/dist`
- `apps/patient-portal/tsconfig.tsbuildinfo`

`dist/` est ignore au root, mais `*.tsbuildinfo` devrait etre ignore globalement.

Correction attendue :

- Ajouter `*.tsbuildinfo` au `.gitignore` root si absent.
- Ne pas versionner les builds.

---

## Prochaine action

Avant tout travail UI MedOS ou Phase 1B, demander a DeepSeek V4 Pro une correction ciblee :

1. Audit log bloquant ou transactionnel.
2. `signNote()` idempotence/refus de double signature.
3. RLS audit `TO service_role` + append-only explicite.
4. DTO arrays corriges.
5. Route patient pour notes partagees ou retrait temporaire des appels patient-portal.
6. Tests supplementaires couvrant ces corrections.

