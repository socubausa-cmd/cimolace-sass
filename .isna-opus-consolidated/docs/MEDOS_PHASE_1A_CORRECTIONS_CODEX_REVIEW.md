# MedOS Phase 1A Corrections — Codex Review

Date : 2026-05-10
Reviewer : Codex
Workspace : `/Users/ngowazulu/Downloads/isna-opus`

---

## Verdict

Les corrections demandees sur le coeur Phase 1A sont majoritairement faites :

- Audit log maintenant bloquant.
- Double signature refusee.
- DTO arrays corriges.
- Route patient `GET /med/me/notes` ajoutee.
- Policy audit limitee a `TO service_role`.
- `.gitignore` contient `*.tsbuildinfo`.
- `npm run build -w @isna/api` : OK.
- `npm test -w @isna/api` : OK, 4 suites / 55 tests.

Mais la correction introduit aussi du code hors perimetre Phase 1A :

- `med/forms`
- `med/health`
- migration `20260510000008_medos_forms_health.sql`

Ce bloc ne doit pas etre considere valide pour MedOS livrable avant review/correction dediee.

---

## Findings P1

### P1. Route health expose potentiellement les donnees d'un autre patient

Fichiers :

- `apps/api/src/medos/medos.controller.ts`
- `apps/api/src/medos/medos.service.ts`

Route concernee :

- `GET /med/health/patient/:patientId`

Le controller autorise le role `patient`, mais ne transmet pas `req.user.id` au service. Le service contient un commentaire indiquant que la verification est geree cote controller, mais ce n'est pas le cas.

Risque : un patient membre du tenant peut tenter de lire les entrees sante d'un autre patient du meme tenant en connaissant son `patientId`.

Correction attendue :

- Soit retirer/desactiver les routes `med/forms` et `med/health` de `MedosModule` car hors scope Phase 1A.
- Soit securiser immediatement :
  - transmettre `actorId` a `getHealthEntries()`;
  - si `tenant.userRole === 'patient'`, verifier que `med_patients.patient_user_id === actorId`;
  - ajouter test de refus patient cross-record.

### P1. Form responses autorise un patient a soumettre pour un autre patient

Fichiers :

- `apps/api/src/medos/medos.controller.ts`
- `apps/api/src/medos/medos.service.ts`

Route concernee :

- `POST /med/forms/:id/responses`

Le role `patient` est autorise, mais le DTO contient `patient_id` fourni par le client. Le service verifie seulement que le patient existe dans le tenant, pas que ce dossier appartient a l'utilisateur connecte.

Risque : soumission de formulaire medical sur le dossier d'un autre patient.

Correction attendue :

- Meme decision que pour health : retirer/desactiver hors scope, ou verifier ownership patient.
- Ajouter test de refus patient qui soumet pour un autre `patient_id`.

---

## Findings P2

### P2. DTOs forms/health non branches ou contournes

Des DTOs existent (`create-form.dto.ts`, `submit-form-response.dto.ts`, `create-health-entry.dto.ts`), mais les controllers utilisent `Record<string, unknown>` ou un type inline.

Correction attendue :

- Utiliser les DTOs dans les controllers.
- Ajouter validation tests.
- Si hors scope, retirer les controllers du module pour l'instant.

### P2. Migration Phase 1B introduite sans validation

Fichier :

- `supabase/migrations/20260510000008_medos_forms_health.sql`

Le prompt demandait explicitement de ne pas lancer Phase 1B. Cette migration ajoute de nouvelles tables et RLS qui n'ont pas encore ete auditees completement.

Correction attendue :

- Ne pas appliquer cette migration en environnement partage avant review.
- Si deja appliquee en dev, la documenter comme brouillon non livrable.

---

## Decision

MedOS Phase 1A core peut etre considere proche de valide, mais le workspace ne doit pas avancer vers UI/client tant que les routes hors perimetre `forms` et `health` restent exposees.

Prochaine action recommandee :

1. Demander a DeepSeek V4 Pro de **desactiver temporairement** `MedosFormsController` et `MedosHealthController` du `MedosModule`, ou de les securiser avec ownership patient + DTOs + tests.
2. Pour rester economique et propre, preferer la desactivation maintenant.
3. Revenir ensuite a Phase 1A strictement : patients + notes + audit.

