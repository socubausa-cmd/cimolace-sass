# Audit MedOS — Etat reel vs cahier des charges

Derniere mise a jour : 2026-05-10

Source documentaire auditee :

- `/Users/ngowazulu/Downloads/MEDOS_CAHIER_DES_CHARGES.docx`
- `/Users/ngowazulu/Downloads/rapport_practicebetter.md`
- `/Users/ngowazulu/Downloads/template.csv`

Code audite :

- `/Users/ngowazulu/Downloads/isna_platform_v2`

## Verdict

MedOS est un prototype backend + site public qui compile et demarre, mais il n'est pas encore conforme au cahier des charges medical.

Lecture croisee avec le rapport Practice Better : le niveau attendu est un SaaS cabinet tout-en-un avec scheduling, teleconsultation, EHR/charting, portail client, paiements, programmes, automations, messagerie securisee, analytics, integrations et mobile. Le code actuel couvre surtout les premieres briques backend EHR, pas encore l'experience produit complete.

Lecture du `template.csv` : fichier minimal pour paiement/mobile money ou import transactionnel avec colonnes `Country,Telco,Currency,MSISDN,Amount,Description`. Aucune integration applicative detectee dans MedOS a ce stade.

Ce qui existe vraiment :

- API NestJS avec modules `med-*`
- migrations SQL medicales de base
- landing/public-site MedOS
- types partages de roles MedOS
- endpoints CRUD simples pour EHR, notes, forms, health, programs, prescriptions, GDPR

Ce qui manque pour considerer MedOS pret :

- apps frontend dediees `apps/med-app` et `apps/patient-portal`
- worker IA medical
- scheduling / calendrier praticien-patient
- messagerie securisee
- analytics cabinet
- mobile app ou experience mobile dediee
- audit medical automatique sur chaque endpoint
- RBAC medical strict par role
- RLS patient/praticien reelles
- vraie IA Deepgram/Claude
- PDF prescriptions, fax, storage medical prive
- tests unitaires/e2e
- validation medicale/RGPD serieuse

## Verifications techniques executees

Depuis `apps/api` :

```bash
npm run build
npm run start
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/
```

Resultat :

- build API OK
- API runtime OK
- `/health` OK
- `/` OK

Depuis `apps/public-site` :

```bash
npm run build
```

Resultat :

- build Next.js OK
- page `/medos` incluse dans les routes statiques

## Etat par composant demande

| Composant cahier des charges | Statut | Constat |
| --- | --- | --- |
| Monorepo ISNA Platform V2 | Partiel | Pas de `package.json` racine. Deux apps seulement : `apps/api`, `apps/public-site`. |
| API MedOS `apps/api/src/med-*` | Partiel | Modules presents, CRUD basiques, peu de validation, pas de RBAC medical fin. |
| `apps/med-app` praticien | Manquant | Dossier absent. |
| `apps/patient-portal` | Manquant | Dossier absent. |
| `apps/worker/src/med-*` | Manquant | Aucun worker dans ce repo. |
| migrations SQL medicales | Partiel | 3 migrations presentes, schemas incomplets vs doc, RLS reduite a `service_role_full_access`. |
| packages types MedOS | Partiel | `packages/types/src/index.ts` contient roles + quelques interfaces, mais types incomplets. |
| site public MedOS | Fait partiel | Landing et pages marketing compilees. Certaines claims depassent l'etat reel du produit. |

## Sprint 1 — Fondation EHR

| Exigence | Statut | Notes |
| --- | --- | --- |
| `patient_records` | Partiel | Table presente. Champs principaux presents, mais `gender` ne couvre pas `prefer_not_to_say`, pas de consentement explicite, RLS faible. |
| `consultation_notes` | Partiel | Table presente. Il manque `session_id`, `ai_summary`, certains champs attendus. |
| `medical_audit_log` | Partiel | Table presente, mais aucun endpoint medical ne logge systematiquement dedans. |
| PatientRecordModule | Partiel | CRUD present : create/list/get/update. Pas de DTO, pas de roles, pas d'audit. |
| ConsultationNoteModule | Partiel | Create/list/update/sign/share presents. Pas de PDF, pas de roles, erreurs non normalisees. |
| Roles MedOS | Partiel | Roles definis dans `packages/types`, mais non appliques dans les guards/controllers. |
| AuditInterceptor medical | Manquant | Aucun interceptor `med-audit`. |
| Tests EHR | Manquant | Aucun `.spec.ts` ou `.e2e-spec.ts` MedOS. |

## Sprint 2 — Formulaires & Trackers

| Exigence | Statut | Notes |
| --- | --- | --- |
| `medical_forms` + `form_responses` | Partiel | Tables presentes. `send_before_days` absent. |
| `health_entries` | Partiel | Table presente mais tres reduite : il manque energy, sleep_quality, BP, heart_rate, glucose, temperature, meal_photos, water, steps, exercise, symptoms. |
| MedFormsModule | Partiel | CRUD + responses presents. Pas de templates/seeds, pas de roles. |
| HealthTrackerModule | Partiel | Create + findByPatient presents. Pas de controle patient/praticien strict. |
| 5 templates formulaires | Manquant | Aucun seed `med_form_templates.sql`. |
| Dashboard praticien `apps/med-app` | Manquant | App absente. |
| Page dossier patient frontend | Manquant | App absente. |

## Sprint 3 — AI Charting

| Exigence | Statut | Notes |
| --- | --- | --- |
| Deepgram/Whisper transcription | Manquant | Service retourne un placeholder. |
| Worker MedChartingJob | Manquant | Pas de worker. |
| Claude SOAP | Manquant | Prompt existe en dur, mais pas d'appel Claude. |
| Env `ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` | Manquant | Pas de `.env.example` racine dans ce repo. |
| `POST /med/charting/transcribe` | Partiel | Route existe mais placeholder. |
| `POST /med/charting/generate` | Partiel risque | Insere dans `consultation_notes` sans `record_id` ni `practitioner_id`, incompatible avec migration actuelle. |
| `GET /med/charting/status/:jobId` | Manquant | Route absente. |
| UI edition note IA | Manquant | `apps/med-app` absent. |

## Sprint 4 — Prescriptions & Portail Patient

| Exigence | Statut | Notes |
| --- | --- | --- |
| `prescriptions` | Partiel | Table presente. Il manque `note_id`, `signature_hash`, `pdf_url`, `fax_status`, `fax_sent_to`. |
| PrescriptionModule | Partiel | Create/list/sign presents. Pas de PDF, pas de hash, pas de fax. |
| PDF ordonnances | Manquant | Aucun worker PDF/Puppeteer. |
| `apps/patient-portal` | Manquant | Dossier absent. |
| Auth patient magic link/JWT | Manquant | Non implemente. |
| 8 pages patient | Manquant | Portail absent. |
| Fax Twilio | Manquant | Non implemente. |

## Sprint 5 — Programmes & automatisations

| Exigence | Statut | Notes |
| --- | --- | --- |
| `care_programs`, `care_program_steps`, `patient_programs` | Partiel | Tables presentes. `program_automations` absent. |
| CareProgramModule | Partiel | CRUD minimal + assignation. |
| Worker automatisations J+N | Manquant | Aucun worker. |
| 5 templates programmes | Manquant | Aucun seed. |
| UI programmes | Manquant | Pas de med-app / patient-portal. |
| Emails rappels | Manquant | Aucun worker/email medical. |

## Sprint 6 — Integrations & lancement

| Exigence | Statut | Notes |
| --- | --- | --- |
| Apple Health | Manquant | Non implemente. |
| Oura Ring | Manquant | Non implemente. |
| Export RGPD dossier JSON/PDF | Partiel | Export JSON basique present dans `med-gdpr`, pas de PDF, pas de controle patient, health export non filtre par patient. |
| Anonymisation RGPD | Partiel risque | Met `patient_user_id` a null alors que la migration le declare `NOT NULL`; operation risque d'echouer. |
| Tests E2E MedOS | Manquant | Aucun test MedOS. |
| Swagger/OpenAPI | Manquant | `@nestjs/swagger` installe, mais pas configure. |
| Monitoring jobs | Manquant | Pas de worker. |

## Securite et conformite

### Fait

- `JwtAuthGuard` appelle Supabase `auth.getUser(token)`.
- `TenantGuard` ajoute un contexte tenant.
- Services filtrent souvent par `tenant_id`.
- Tables RLS activees.

### Partiel / insuffisant

- RLS n'autorise que `service_role`; l'isolation repose donc presque entierement sur l'API.
- Les roles MedOS ne sont pas appliques avec `@Roles`.
- Plusieurs endpoints acceptent `any` sans DTO ni validation metier.
- Aucun audit log automatique n'est ecrit.
- Pas de consentement explicite patient.
- Pas de chiffrement applicatif AES-256-GCM des donnees medicales sensibles.
- Pas de bucket prive medical.
- Pas de politique de retention.

### Risques critiques

- `scripts/e2e_test.js` contient une cle Supabase service-role en clair. Il faut la retirer du repo et rotater la cle si elle a ete exposee.
- `apps/api/.env` existe localement avec secrets probables et est tracke par Git.
- `apps/api/node_modules` est aussi tracke par Git, ce qui pollue fortement le depot.
- Il n'y a pas de `.gitignore` racine.
- Le site public annonce "Deja en production", "AES-256", "IA Charting", "PDF", "fax", alors que le code est majoritairement placeholder.
- `CheckoutService` est un placeholder : pas de vrai Stripe SDK, pas de verification signature webhook.
- `LiveService.generateToken` retourne `livekit_jwt_placeholder`.
- `MedChartingService.generateNote` risque de casser en base car il insere une note sans `record_id` ni `practitioner_id`.
- `MedGdprService.anonymize` risque de casser car `patient_user_id` est `NOT NULL`.

## Ce qui est vraiment termine

- Build API.
- Runtime API.
- Build public-site.
- Health endpoints.
- Catalogue Cimolace/MedOS.
- Landing page MedOS.
- Tables medicales de base.
- Endpoints CRUD medical minimal.
- Types de roles MedOS declares.

## Ce qui reste prioritaire

1. Retirer tout secret du repo et rotater la service-role exposee.
2. Corriger les claims marketing publics pour ne pas promettre des fonctions non implementees.
3. Ajouter RBAC medical strict sur tous les controllers MedOS.
4. Ajouter DTO + ValidationPipe robuste pour toutes les entrees medicales.
5. Implementer audit log medical automatique.
6. Revoir RLS avec policies patient/praticien/receptionist reelles.
7. Corriger les schemas incomplets et incompatibles (`consultation_notes`, prescriptions, health, gdpr anonymize).
8. Implementer le vrai Stripe webhook et le vrai LiveKit token ou retirer les endpoints de promesse production.
9. Creer `apps/med-app`.
10. Creer `apps/patient-portal`.
11. Creer `apps/worker` medical pour charting/PDF/automations.
12. Ajouter tests unitaires et E2E MedOS.
13. Planifier scheduling, messagerie, analytics et integrations type Apple Health/Oura/Fitbit/Zoom/Calendar pour atteindre le niveau Practice Better.

## Ordre de reprise conseille

### Phase A — Securite immediate

- `scripts/e2e_test.js` remplace maintenant la cle par des variables d'env.
- Rotater la cle Supabase service-role.
- `.gitignore` racine ajoute.
- Retrait du suivi Git effectue pour `apps/api/.env`, `apps/api/node_modules`, `apps/public-site/node_modules`, `apps/api/dist`, `apps/public-site/.next`.
- Verifier `git status` et l'historique avant tout push.

Plan d'execution livrable : `docs/MEDOS_DELIVERY_PLAN.md`.

### Phase B — Stabiliser backend medical

- Ajouter DTOs.
- Ajouter roles guards.
- Ajouter audit interceptor.
- Corriger les migrations manquantes/incompletes.
- Ajouter tests unitaires EHR/notes/prescriptions/GDPR.

### Phase C — Prouver le module EHR

- Scenario E2E : praticien cree patient -> cree note -> signe -> exporte -> audit log verifie.
- Scenario securite : patient A ne voit jamais patient B.

### Phase D — Frontends

- Scaffold `apps/med-app`.
- Scaffold `apps/patient-portal`.
- Brancher uniquement les modules prouves cote API.

### Phase E — IA, PDF, automations

- Worker MedCharting.
- Deepgram/Whisper.
- Claude SOAP.
- PDF prescriptions.
- emails/rappels/programmes.
