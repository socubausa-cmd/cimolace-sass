# Plan d'execution MedOS livrable

Derniere mise a jour : 2026-05-10

Objectif : transformer le prototype MedOS actuel en produit livrable, conforme au cahier des charges MedOS et rapproche du niveau fonctionnel Practice Better.

## Etat de depart

Base retenue :

- `/Users/ngowazulu/Downloads/isna_platform_v2`

Documents de reference :

- `/Users/ngowazulu/Downloads/MEDOS_CAHIER_DES_CHARGES.docx`
- `/Users/ngowazulu/Downloads/rapport_practicebetter.md`
- `/Users/ngowazulu/Downloads/template.csv`
- `docs/MEDOS_AUDIT_STATUS.md`

Etat actuel :

- API MedOS compile et demarre.
- Public-site compile.
- Modules backend `med-*` existent mais restent CRUD/prototype.
- Frontend praticien absent.
- Portail patient absent.
- Worker medical absent.
- Securite medicale incomplete.

## Regle de priorite

MedOS manipule des donnees de sante. La securite, l'isolation tenant, l'audit et la conformite passent avant les features visibles.

Aucune promesse marketing "production", "RGPD natif", "AES-256", "IA Charting", "PDF ordonnance" ne doit rester publique tant que le code correspondant n'est pas implemente et teste.

## Phase 0 — Hygiene repo et secrets

Statut : en cours.

Travail deja fait :

- Ajout `.gitignore` racine.
- Ajout `apps/api/.env.example`.
- Ajout `apps/public-site/.env.example`.
- Retrait du suivi Git de :
  - `apps/api/.env`
  - `apps/api/node_modules`
  - `apps/public-site/node_modules`
  - `apps/api/dist`
  - `apps/public-site/.next`
- Remplacement de la cle service-role hardcodee dans `scripts/e2e_test.js` par des variables d'environnement.

Reste obligatoire :

1. Rotater la cle Supabase service-role exposee.
2. Verifier l'historique Git avant tout push public/prive partage.
3. Ajouter `.env.example` propre pour API/public-site.
4. Ajouter une commande de verification secrets avant commit.

Critere de sortie :

- `git ls-files` ne contient aucun `.env`, `node_modules`, `dist`, `.next`.
- `git grep` ne trouve aucune valeur de secret reelle.
- nouvelle cle Supabase service-role generee.

## Phase 1 — Socle backend medical fiable

Objectif : rendre l'API medicale sure avant UI.

Travail :

1. Ajouter DTOs + validation pour tous les modules :
   - `med-ehr`
   - `med-notes`
   - `med-forms`
   - `med-health`
   - `med-programs`
   - `med-prescriptions`
   - `med-gdpr`
2. Ajouter RBAC medical :
   - `practitioner`
   - `clinic_admin`
   - `receptionist`
   - `patient`
3. Ajouter guards/policies par endpoint :
   - patient ne lit que son dossier
   - receptionist ne lit pas les notes cliniques internes
   - clinic_admin ne signe pas les ordonnances
   - practitioner signe notes/prescriptions
4. Ajouter `MedAuditInterceptor` :
   - log `view/create/update/export/sign/share/anonymize`
   - table `medical_audit_log`
   - actor, tenant, resource, resource_id, ip, user_agent
5. Normaliser les erreurs API.

Critere de sortie :

- tests unitaires passent
- un scenario praticien cree patient -> note -> signe -> audit log OK
- scenario patient A ne voit jamais patient B

Agents conseilles :

- Sonnet/Opus pour RBAC, audit, RLS, donnees de sante.
- Pro pour DTOs et CRUD non critique apres design valide.

## Phase 2 — Migrations et RLS medicales reelles

Objectif : aligner la DB avec le cahier des charges.

Travail :

1. Corriger schemas :
   - `patient_records`
   - `consultation_notes`
   - `medical_forms`
   - `form_responses`
   - `health_entries`
   - `care_programs`
   - `patient_programs`
   - `program_automations`
   - `prescriptions`
2. Ajouter champs manquants :
   - consentement explicite patient
   - `session_id`, `ai_summary`
   - health vitals complets
   - prescription `note_id`, `signature_hash`, `pdf_url`, `fax_status`
3. Remplacer RLS `service_role_full_access` seule par policies :
   - praticien/clinic_admin/receptionist selon role
   - patient uniquement ses ressources autorisees
   - service_role pour jobs internes seulement
4. Corriger anonymisation RGPD :
   - ne pas mettre `patient_user_id` a null si colonne `NOT NULL`
   - preferer pseudonymisation/anonymisation conforme.

Critere de sortie :

- migrations applicables sur base neuve
- tests SQL/RLS minimaux
- aucun endpoint ne depend uniquement de "bon comportement frontend"

## Phase 3 — EHR MVP praticien

Objectif : livrer le coeur medical minimal.

Scope MVP :

- creer patient
- lister patients
- afficher dossier patient
- creer note SOAP
- modifier note non signee
- signer/verrouiller note
- partager resume patient
- audit automatique

Frontend :

- creer `apps/med-app`
- pages :
  - login/token dev ou auth Supabase
  - dashboard
  - patients
  - patient detail
  - note editor

Critere de sortie :

- E2E navigateur : praticien cree patient, ecrit note, signe, audit visible.

## Phase 4 — Portail patient MVP

Objectif : donner au patient un espace securise.

Créer `apps/patient-portal`.

Pages MVP :

- `/dashboard`
- `/records`
- `/notes`
- `/forms`
- `/journal`
- `/programs`

Regles :

- patient lecture seule sur dossier medical
- patient cree uniquement ses entrees journal
- patient voit seulement les notes partagees
- toute lecture dossier est auditee

Critere de sortie :

- patient A ne peut pas acceder aux ressources patient B, meme avec ID connu.

## Phase 5 — Forms, health tracking, programs

Objectif : couvrir le gros differentiateur Practice Better.

Travail :

- templates formulaires :
  - intake general
  - bilan nutritionnel
  - consentement eclaire
  - PHQ-9
  - suivi post-consultation
- journal sante complet
- programmes de soins
- templates programmes :
  - detox 21 jours
  - perte de poids 3 mois
  - gestion stress 6 semaines
  - reeducation post-op
  - sevrage tabac
- automatisations J+N via worker

Critere de sortie :

- praticien assigne programme
- patient voit et avance dans les etapes
- rappels generes par worker

## Phase 6 — Paiements, scheduling, teleconsultation

Objectif : rendre MedOS commercialisable.

Travail :

- vrai scheduling :
  - disponibilites praticien
  - booking patient
  - annulation/deplacement
  - rappels email/SMS
- vrai LiveKit token
- vrai Stripe Checkout/webhook
- CinetPay/mobile money selon `template.csv`
- factures et paiements consultation
- packages / abonnements client plus tard

Critere de sortie :

- patient reserve, paie, rejoint teleconsultation
- webhook signe cree l'acces
- facturation visible praticien

## Phase 7 — AI Charting, PDF, fax

Objectif : livrer les fonctions avancees.

Worker medical :

- `apps/worker/src/med-charting`
- Deepgram/Whisper transcription
- Claude SOAP JSON strict
- sauvegarde draft
- notification praticien

Prescriptions :

- hash signature
- PDF ordonnance
- stockage prive
- fax/email pharmacie/labo

Critere de sortie :

- audio consultation -> transcription -> brouillon SOAP -> validation -> signature
- ordonnance signee -> PDF telechargeable

## Phase 8 — Compliance, docs, lancement

Travail :

- export RGPD JSON + PDF
- retention configurable
- Swagger/OpenAPI
- monitoring erreurs jobs
- logs securite
- page statut
- runbooks incident
- tests E2E complets

Critere de sortie livrable :

- audit security OK
- tests E2E OK
- documentation API OK
- claims marketing alignes avec code

## Decoupage agents

### Agent securite critique

- secrets
- RBAC
- RLS
- audit logs
- GDPR
- payment webhook

### Agent backend standard

- DTOs
- CRUD propre
- services Supabase
- tests unitaires

### Agent frontend

- `apps/med-app`
- `apps/patient-portal`
- UI dossier patient, notes, forms, programs

### Agent worker

- IA charting
- PDF
- automations
- email/SMS

### Agent docs/QA

- runbooks
- Swagger
- E2E scripts
- matrice Practice Better

## Premiere sequence concrete

1. Finaliser Phase 0 hygiene.
2. Rotater service-role Supabase.
3. Implementer `RolesGuard` medical.
4. Implementer `MedAuditInterceptor`.
5. Corriger migrations `patient_records`, `consultation_notes`, `medical_audit_log`.
6. Ajouter tests EHR + audit.
7. Scaffold `apps/med-app`.
8. Livrer EHR MVP praticien.
