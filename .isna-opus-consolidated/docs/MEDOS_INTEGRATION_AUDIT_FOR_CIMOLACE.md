# MedOS Integration Audit for Cimolace

Date : 2026-05-10
Agent : DeepSeek V4 Pro (isna-opus)
Périmètre : Audit comparatif `isna_platform_v2` (prototype MedOS) vs `isna-opus` (socle Cimolace stable)

---

## 1. Verdict global

**MedOS n'est PAS prêt à être migré dans le socle Cimolace stable.**

Le prototype `isna_platform_v2` contient une base de code fonctionnelle (CRUD médical, tables SQL, concepts SOAP/AI Charting) mais avec des lacunes critiques de sécurité, de conformité et d'architecture qui doivent être résolues AVANT toute migration vers `isna-opus`.

**Recommandation** : Phase de stabilisation MédOS dans `isna_platform_v2` d'abord, puis migration module par module vers `isna-opus` en respectant le pattern RBAC/audit/RLS déjà prouvé dans le socle.

---

## 2. Sources lues

### Socle Cimolace (`isna-opus`)
| Document | Chemin |
|---|---|
| AGENTS.md | `isna-opus/AGENTS.md` |
| CIMOLACE_PLATFORM_AUDIT.md | `isna-opus/docs/CIMOLACE_PLATFORM_AUDIT.md` |
| V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md | `isna-opus/docs/V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md` |
| CIMOLACE_CATALOG_CODEX_REVIEW.md | `isna-opus/docs/CIMOLACE_CATALOG_CODEX_REVIEW.md` |
| CIMOLACE_CATALOG_E2E_REPORT.md | `isna-opus/docs/CIMOLACE_CATALOG_E2E_REPORT.md` |
| CIMOLACE_ONBOARDING_CATALOG_STATUS.md | `isna-opus/docs/CIMOLACE_ONBOARDING_CATALOG_STATUS.md` |
| TENANCY_AND_BACKEND_BOUNDARIES.md | `isna-opus/docs/TENANCY_AND_BACKEND_BOUNDARIES.md` |

### Prototype MedOS (`isna_platform_v2`)
| Source | Chemin |
|---|---|
| MEDOS_AUDIT_STATUS.md | `isna_platform_v2/docs/MEDOS_AUDIT_STATUS.md` |
| MEDOS_DELIVERY_PLAN.md | `isna_platform_v2/docs/MEDOS_DELIVERY_PLAN.md` |
| med-ehr | `apps/api/src/med-ehr/*` |
| med-notes | `apps/api/src/med-notes/*` |
| med-prescriptions | `apps/api/src/med-prescriptions/*` |
| med-forms | `apps/api/src/med-forms/*` |
| med-health | `apps/api/src/med-health/*` |
| med-programs | `apps/api/src/med-programs/*` |
| med-charting | `apps/api/src/med-charting/*` |
| med-gdpr | `apps/api/src/med-gdpr/*` |
| auth | `apps/api/src/auth/auth.service.ts` |
| guards | `apps/api/src/common/guards/jwt-auth.guard.ts`, `tenant.guard.ts` |
| cimolace catalog | `apps/api/src/cimolace/service-catalog.service.ts` |
| migrations | `supabase/migrations/001_tenants.sql`, `002_med_ehr.sql`, `003_med_modules.sql` |
| types | `packages/types/src/index.ts` |

### Documents métier
| Document | Chemin |
|---|---|
| Cahier des charges MedOS | `/Users/ngowazulu/Downloads/MEDOS_CAHIER_DES_CHARGES.docx` |
| Rapport Practice Better | `/Users/ngowazulu/Downloads/rapport_practicebetter.md` |
| Template paiement | `/Users/ngowazulu/Downloads/template.csv` |

---

## 3. Architecture MedOS actuelle dans `isna_platform_v2`

```
apps/api/src/
  ├── med-ehr/          PatientRecordModule     (CRUD patients)
  ├── med-notes/        ConsultationNoteModule  (CRUD notes SOAP + sign/share)
  ├── med-prescriptions/ MedPrescriptionsModule (CRUD prescriptions + sign)
  ├── med-forms/        MedFormsModule          (CRUD forms + responses)
  ├── med-health/       MedHealthModule         (health entries)
  ├── med-programs/     MedProgramsModule       (care programs + assignation)
  ├── med-charting/     MedChartingModule       (transcription/AI placeholder)
  ├── med-gdpr/         MedGdprModule           (export/anonymization)
  ├── auth/             AuthService             (Supabase client, verifyToken)
  ├── tenant/           TenantService           (resolveTenant by slug)
  ├── cimolace/         ServiceCatalogService   (ENGINE_CATALOG, INFRA_TEMPLATES)
  └── common/guards/    JwtAuthGuard, TenantGuard

packages/types/src/
  └── index.ts          MEDOS_ROLES, PatientRecord, ConsultationNote, ApiResponse

supabase/migrations/
  ├── 001_tenants.sql           tenants + memberships (minimal)
  ├── 002_med_ehr.sql           patient_records, consultation_notes, medical_audit_log
  └── 003_med_modules.sql       medical_forms, form_responses, health_entries,
                                 care_programs, care_program_steps, patient_programs,
                                 prescriptions
```

### Points positifs de l'architecture

- Tous les contrôleurs utilisent `JwtAuthGuard + TenantGuard` : isolation tenant respectée.
- Les services filtrent par `tenant_id` dans chaque requête Supabase.
- Les tables ont `tenant_id` comme colonne obligatoire.
- Le concept de catalogue Cimolace avec `ENGINE_CATALOG` et `INFRA_TEMPLATES` est présent.
- Les rôles MedOS (`practitioner`, `clinic_admin`, `receptionist`, `patient`) sont déclarés dans `packages/types`.

### Points négatifs critiques

- **Aucun RBAC médical appliqué** : pas de `RolesGuard`, pas de `@Roles()`. N'importe quel membre du tenant peut créer/modifier des patients.
- **Aucune validation DTO** : tous les `@Body()` sont typés `any`. N'importe quelle donnée peut être injectée.
- **Aucun audit log automatique** : la table `medical_audit_log` existe mais aucun endpoint n'écrit dedans.
- **RLS inexistante pour les utilisateurs** : toutes les policies sont `service_role_full_access`. L'isolation repose entièrement sur l'API.
- **AuthService fragile** : pas de `ConfigService`, pas de gestion d'erreur réseau, pas de typed database.
- **Bugs critiques** :
  - `med-charting.generateNote()` insère sans `record_id` ni `practitioner_id` → crash DB.
  - `med-gdpr.anonymize()` met `patient_user_id = null` sur colonne `NOT NULL` → crash DB.
- **Pas de tests** : 0 fichier `.spec.ts` ou `.e2e-spec.ts` dans tout MedOS.

---

## 4. État réel vs cahier des charges

| Exigence cahier des charges | Statut prototype | Écart |
|---|---|---|
| Dossier patient (EHR) avec tous les champs | Partiel | Manque `prefer_not_to_say`, consentement explicite, `session_id` |
| Notes SOAP avec signature | Partiel | CRUD présent, signature OK. Manque `ai_summary`, `session_id`, PDF export |
| AI Charting (Deepgram + Claude) | Placeholder | Services retournent des mocks. Pas d'appel API réel |
| Formulaires médicaux | Partiel | CRUD présent. Pas de templates seeds, pas de `send_before_days` |
| Health tracking | Partiel | Très minimal (mood, sleep, weight seulement). Manque 15+ champs vitaux |
| Programmes de soins | Partiel | CRUD présent. Pas d'automatisations, pas de templates seeds, pas de worker |
| Prescriptions + PDF + fax | Partiel | CRUD présent. Manque `note_id`, `signature_hash`, `pdf_url`, `fax_status`, worker PDF |
| GDPR export/anonymization | Partiel risqué | Export JSON basique présent. Anonymization cassée (NOT NULL violation) |
| Portail patient | Absent | `apps/patient-portal` inexistant |
| Frontend praticien (med-app) | Absent | `apps/med-app` inexistant |
| Worker médical | Absent | `apps/worker` sans code MedOS |
| RBAC médical (practitioner/patient/receptionist) | Absent | Rôles déclarés mais jamais appliqués |
| Audit log automatique | Absent | Table existe mais jamais écrite |
| RLS patient/praticien | Absent | RLS = `service_role_full_access` uniquement |
| Tests | Absent | 0 test MedOS |
| Scheduling / calendrier praticien | Absent | Non implémenté |
| Téléconsultation intégrée | Placeholder | `LiveService.generateToken` retourne `livekit_jwt_placeholder` |
| Paiements | Placeholder | `CheckoutService` est un mock sans Stripe SDK |
| Messagerie sécurisée | Absent | Non implémenté |
| Intégrations wearables (Apple Health, Oura) | Absent | Non implémenté |

### Taux de complétion estimé

- Backend CRUD médical de base : ~30%
- Sécurité médicale (RBAC, RLS, audit) : ~5%
- Frontend (med-app, patient-portal) : 0%
- Worker IA/PDF/automations : 0%
- Compliance RGPD : ~10%

---

## 5. État réel vs Practice Better

| Fonctionnalité Practice Better | MedOS prototype | Niveau |
|---|---|---|
| Dossier patient électronique (EHR) | CRUD basique | 15% |
| Notes cliniques structurées (SOAP) | CRUD + sign | 25% |
| AI Charting | Placeholder | 5% |
| Formulaires personnalisables | CRUD basique | 15% |
| Trackers santé / journal | 4 champs sur 20+ | 10% |
| Programmes de soins | CRUD sans automatisation | 10% |
| Scheduling / prise de RDV | Absent | 0% |
| Téléconsultation intégrée | Placeholder LiveKit | 5% |
| Portail patient | Absent | 0% |
| Messagerie sécurisée | Absent | 0% |
| Paiements intégrés | Placeholder | 5% |
| Facturation | Absent | 0% |
| Prescriptions + PDF | CRUD sans PDF | 15% |
| Fax numérique | Absent | 0% |
| Automatisations / workflows | Absent | 0% |
| Rapports & analytics | Absent | 0% |
| Intégrations tierces (Apple Health, Oura) | Absent | 0% |
| Application mobile | Absent | 0% |
| Conformité HIPAA/GDPR | Export basique, anonymization cassée | 5% |
| Multi-tenant natif | Oui (TenantGuard) | 80% |
| RBAC médical | Rôles déclarés, non appliqués | 10% |

**Moyenne pondérée : ~8% du niveau Practice Better.**

---

## 6. Matrice des modules

| Module | Existe ? | Qualité code | Sécurité | tenant_id | RBAC | RLS | Tests | Action recommandée |
|---|---|---|---|---|---|---|---|---|
| **med-ehr** (PatientRecord) | Oui | Faible (`any`, pas de DTO) | Faible (aucun guard rôle) | Oui | Non | Non (service_role) | Non | **Réécrire** avec DTOs + RolesGuard + audit |
| **med-notes** (ConsultationNote) | Oui | Moyen (sign/share OK) | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec RBAC + audit |
| **med-prescriptions** | Oui | Faible (3 méthodes) | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec signature_hash + PDF |
| **med-forms** | Oui | Faible | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec templates + RBAC |
| **med-health** | Oui | Très faible (2 méthodes) | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec 15+ champs vitaux |
| **med-programs** | Oui | Faible | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec automatisations |
| **med-charting** | Oui | Placeholder + bug critique | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec vrais appels API |
| **med-gdpr** | Oui | Placeholder + bug critique | Faible | Oui | Non | Non (service_role) | Non | **Réécrire** avec anonymization correcte |
| **auth** (AuthService) | Oui | Faible (pas ConfigService) | Faible | — | — | — | Non | **Remplacer** par SupabaseService de isna-opus |
| **tenant** (TenantService) | Oui | OK | OK | Oui | — | — | Non | **Remplacer** par TenantModule de isna-opus |
| **guards** (JwtAuth, Tenant) | Oui | OK | OK | Oui | — | — | Partiel | **Remplacer** par guards isna-opus (plus robustes) |
| **cimolace catalog** | Oui | OK (statique) | OK | — | — | — | Non | **Déjà migré** dans isna-opus |
| **types** (packages/types) | Oui | Minimal | — | — | — | — | Non | **Compléter** avec DTOs complets |
| **migrations SQL** | 3 fichiers | Incomplet vs cahier | Faible (RLS service_role) | Oui | — | Non réelle | Non | **Refondre** : schémas complets + RLS réelle |
| **med-app** | Non | — | — | — | — | — | — | **Créer** de zéro |
| **patient-portal** | Non | — | — | — | — | — | — | **Créer** de zéro |
| **med-worker** | Non | — | — | — | — | — | — | **Créer** de zéro |

---

## 7. Risques critiques

### Risque 1 — Données médicales sans protection RBAC (CRITIQUE)

Tout membre du tenant peut accéder à tous les dossiers patients. Un `receptionist` peut modifier une note SOAP. Un `patient` pourrait techniquement lister tous les patients du tenant.

**Impact** : Violation RGPD, exposition de données de santé, non-conformité légale.
**Correction** : RolesGuard + @Roles sur chaque endpoint avant toute migration.

### Risque 2 — Secrets exposés dans le repo (CRITIQUE)

`scripts/e2e_test.js` contient une clé service-role Supabase en clair. `apps/api/.env` est tracké par Git.

**Impact** : Compromission possible de la base de production.
**Correction** : Rotation immédiate des clés, `.gitignore`, `git rm --cached`.

### Risque 3 — RLS `service_role_full_access` uniquement (CRITIQUE)

Toutes les tables médicales n'ont qu'une seule policy RLS : `TO service_role USING (true)`. Aucune isolation au niveau DB pour les utilisateurs normaux.

**Impact** : Si l'API a un bug ou est contournée, toutes les données médicales sont exposées.
**Correction** : Policies RLS par rôle (practitioner, patient, receptionist) avant mise en production.

### Risque 4 — Bugs critiques dans le code (HAUT)

- `med-charting.generateNote()` : insert sans `record_id` ni `practitioner_id` → violation NOT NULL
- `med-gdpr.anonymize()` : `patient_user_id = null` sur colonne NOT NULL → violation contrainte

**Impact** : Crash en production, données incohérentes.
**Correction** : Corriger les schémas ET le code en cohérence.

### Risque 5 — Pages marketing mensongères (HAUT)

Le site public annonce "Déjà en production", "AES-256", "IA Charting", "PDF ordonnances", "fax" alors que le code est majoritairement placeholder.

**Impact** : Risque juridique et réputationnel si des clients s'inscrivent.
**Correction** : Aligner le marketing sur l'état réel ou marquer clairement "Bêta".

### Risque 6 — 0 test médical (HAUT)

Aucun test unitaire ou E2E sur le code médical.

**Impact** : Aucune garantie de non-régression, bugs silencieux possibles.
**Correction** : Tests obligatoires avant toute migration.

---

## 8. Ce qui peut être migré tel quel

**Rien ne peut être migré tel quel sans adaptation.**

Éléments réutilisables avec adaptation légère :

| Élément | Réutilisable ? | Adaptation nécessaire |
|---|---|---|
| Schémas de tables SQL (concept) | Oui | Compléter les colonnes manquantes, corriger les contraintes |
| Concepts métier (SOAP, EHR, formulaires) | Oui | Encapsuler dans des DTOs validés |
| Noms de routes REST | Oui | Ajouter les guards RBAC |
| Catalogue ENGINE_CATALOG | Déjà migré | N/A (déjà dans isna-opus) |
| Déclarations de rôles MedOS | Oui | Appliquer via RolesGuard + @Roles |

Éléments à jeter complètement :

| Élément | Raison |
|---|---|
| `AuthService` (isna_platform_v2) | Remplacé par `SupabaseService` (isna-opus) — ConfigService, typed DB |
| `JwtAuthGuard` (isna_platform_v2) | Remplacé par celui de isna-opus — support JWKS ES256 |
| `TenantGuard` (isna_platform_v2) | Remplacé par celui de isna-opus — membership check complet |
| `TenantService` (isna_platform_v2) | Remplacé par `TenantModule` (isna-opus) |
| `CheckoutService` (placeholder) | Remplacé par le vrai `CheckoutModule` (isna-opus) |
| `LiveService` (placeholder) | Remplacé par le vrai `LiveModule` + `LiveKitModule` (isna-opus) |

---

## 9. Ce qui doit être réécrit plutôt que copié

Tous les modules `med-*` doivent être **réécrits** dans `isna-opus` en respectant les standards déjà établis :

### Pattern cible pour un module MedOS dans isna-opus

```
apps/api/src/med-ehr/
  ├── med-ehr.module.ts
  ├── med-ehr.service.ts          # Logique métier avec SupabaseService typé
  ├── med-ehr.controller.ts       # Endpoints avec @Roles + DTOs
  ├── dto/
  │   ├── create-patient.dto.ts   # Validation class-validator
  │   └── update-patient.dto.ts
  └── med-ehr.service.spec.ts     # Tests unitaires

supabase/migrations/
  └── 2026XXXX_med_ehr.sql        # Schéma complet + RLS par rôle
```

### Règles obligatoires par module

1. **DTOs avec `class-validator`** : plus de `@Body() body: any`
2. **`@Roles('practitioner', 'clinic_admin')`** sur chaque endpoint
3. **`MedAuditInterceptor`** ou log manuel dans le service
4. **`tenant_id` systématique** depuis `@CurrentTenant()`
5. **RLS par rôle** dans les migrations (pas `service_role_full_access`)
6. **Tests unitaires** : minimum 5 cas par service
7. **Pas de `process.env` direct** : utiliser `ConfigService`

---

## 10. Schéma cible MedOS dans `isna-opus`

```
isna-opus/
├── apps/api/src/
│   ├── med-ehr/              # PatientRecordModule     [Sprint 1]
│   ├── med-notes/            # ConsultationNoteModule  [Sprint 1]
│   ├── med-prescriptions/    # PrescriptionModule      [Sprint 4]
│   ├── med-forms/            # MedFormsModule          [Sprint 2]
│   ├── med-health/           # HealthTrackerModule     [Sprint 2]
│   ├── med-programs/         # CareProgramModule       [Sprint 5]
│   ├── med-charting/         # MedChartingModule       [Sprint 3]
│   ├── med-gdpr/             # MedGdprModule           [Sprint 6]
│   └── common/interceptors/
│       └── med-audit.interceptor.ts
├── apps/med-app/             # Frontend praticien      [Sprint 2+]
├── apps/patient-portal/      # Portail patient         [Sprint 4]
├── apps/worker/src/
│   └── med-*/                # Jobs IA, PDF, automations [Sprint 3+]
├── supabase/migrations/
│   └── 2026XXXX_med_*.sql    # Migrations complètes + RLS réelle
└── packages/types/src/
    └── med-*.ts              # Types + DTOs partagés
```

---

## 11. Endpoints API cibles

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| POST | `/med/patients` | practitioner, clinic_admin | Créer dossier patient |
| GET | `/med/patients` | practitioner, clinic_admin, receptionist | Lister patients |
| GET | `/med/patients/:id` | practitioner, clinic_admin | Voir dossier |
| PATCH | `/med/patients/:id` | practitioner | Modifier dossier |
| GET | `/med/patients/:id/notes` | practitioner, clinic_admin | Notes du patient |
| POST | `/med/patients/:id/notes` | practitioner | Créer note SOAP |
| PATCH | `/med/notes/:id` | practitioner | Modifier note non signée |
| POST | `/med/notes/:id/sign` | practitioner | Signer note |
| POST | `/med/notes/:id/share` | practitioner | Partager note au patient |
| POST | `/med/charting/transcribe` | practitioner | Lancer transcription |
| POST | `/med/charting/generate` | practitioner | Générer note IA |
| GET | `/med/charting/status/:jobId` | practitioner | Statut job IA |
| POST | `/med/charting/regenerate/:noteId` | practitioner | Regénérer draft IA |
| GET | `/med/forms` | practitioner, clinic_admin, receptionist | Lister formulaires |
| POST | `/med/forms` | practitioner, clinic_admin | Créer formulaire |
| POST | `/med/forms/:id/responses` | practitioner, patient | Soumettre réponse |
| GET | `/med/forms/:id/responses` | practitioner, clinic_admin | Voir réponses |
| POST | `/med/health` | patient | Créer entrée journal |
| GET | `/med/health/patient/:patientId` | practitioner, patient | Voir journal patient |
| GET | `/med/programs` | practitioner, clinic_admin, patient | Lister programmes |
| POST | `/med/programs` | practitioner, clinic_admin | Créer programme |
| POST | `/med/programs/:id/assign` | practitioner | Assigner à un patient |
| GET | `/med/programs/patient/:patientId` | practitioner, patient | Programmes du patient |
| GET | `/med/prescriptions/record/:recordId` | practitioner, patient | Ordonnances patient |
| POST | `/med/prescriptions` | practitioner | Créer ordonnance |
| POST | `/med/prescriptions/:id/sign` | practitioner | Signer ordonnance |
| GET | `/med/gdpr/export/:recordId` | practitioner, patient | Export RGPD dossier |
| POST | `/med/gdpr/anonymize/:recordId` | clinic_admin | Anonymiser dossier |

---

## 12. Tables Supabase cibles (schémas complets)

### À ajouter à `isna-opus` (avec colonnes manquantes vs prototype)

| Table | Statut prototype | Colonnes à ajouter pour conformité |
|---|---|---|
| `patient_records` | Partiel | `consent_given`, `consent_date`, `consent_purpose`, `gender` ajouter `prefer_not_to_say` |
| `consultation_notes` | Partiel | `session_id`, `ai_summary`, `icd10_codes` → JSONB avec `[{code, description, is_primary}]` |
| `medical_audit_log` | Existe (jamais écrite) | Complet, ajouter `user_agent`, `ip_address` |
| `medical_forms` | Partiel | `send_before_days` |
| `form_responses` | OK | RAS |
| `health_entries` | Très partiel | Ajouter : `energy_level`, `sleep_quality`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `heart_rate`, `blood_glucose`, `temperature`, `meal_photos`, `food_notes`, `water_liters`, `steps`, `exercise_minutes`, `symptoms` |
| `care_programs` | OK | Ajouter `category`, `is_template` |
| `care_program_steps` | OK | RAS |
| `patient_programs` | OK | Ajouter `progress_pct`, `completed_steps[]` |
| `prescriptions` | Partiel | Ajouter `note_id`, `signature_hash`, `pdf_url`, `fax_status`, `fax_sent_to` |

### RLS cible (remplace `service_role_full_access`)

Chaque table doit avoir :

```sql
-- Practitioner / clinic_admin / receptionist peuvent lire
CREATE POLICY "med_staff_read" ON patient_records
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = patient_records.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin','receptionist')
        AND status = 'active')
  );

-- Patient ne voit que SON dossier
CREATE POLICY "patient_read_own" ON patient_records
  FOR SELECT USING (
    patient_user_id = auth.uid()
  );

-- Practitioner / clinic_admin peuvent écrire
CREATE POLICY "practitioner_write" ON patient_records
  FOR INSERT WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = patient_records.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active')
  );
```

---

## 13. Ordre de migration recommandé

### Phase 0 — Prérequis (dans isna-opus, déjà fait)
- [x] Socle catalogue Cimolace (tenant_services, infrastructure_type)
- [x] E2E catalogue validé
- [x] Onboarding avec choix infrastructure intégré

### Phase 1 — Stabilisation sécurité MedOS (dans isna_platform_v2, 1-2 semaines)
1. Rotater les secrets exposés
2. Ajouter `.gitignore` et nettoyer le repo
3. Implémenter `RolesGuard` médical + `@Roles`
4. Ajouter DTOs + ValidationPipe sur tous les modules
5. Ajouter `MedAuditInterceptor`
6. Corriger les bugs critiques (charting, gdpr anonymize)
7. Corriger les schémas incomplets
8. Ajouter tests unitaires minimum

### Phase 2 — Migration EHR + Notes (vers isna-opus, 2 semaines)
1. Créer migration SQL `med_ehr` dans isna-opus
2. Créer `MedEhrModule` avec DTOs + RBAC + audit
3. Créer `ConsultationNoteModule` avec DTOs + RBAC + audit
4. Ajouter RLS réelle (practitioner/patient)
5. Tests unitaires + E2E : "praticien crée patient → crée note → signe"

### Phase 3 — Formulaires + Health (vers isna-opus, 1-2 semaines)
1. Migration `med_forms` + `med_health`
2. `MedFormsModule` avec 5 templates seeds
3. `HealthTrackerModule` avec tous les champs vitaux
4. RLS + tests

### Phase 4 — Prescriptions + Portail patient (vers isna-opus, 2 semaines)
1. Migration `med_prescriptions` (complète)
2. `PrescriptionModule` avec signature_hash
3. Scaffold `apps/patient-portal`
4. Auth patient (magic link / JWT)
5. Pages portail patient MVP

### Phase 5 — AI Charting + Worker (vers isna-opus, 2 semaines)
1. Worker `med-charting` avec Deepgram + Claude
2. Intégration réelle (pas de placeholder)
3. `MedChartingModule` dans l'API
4. Worker PDF prescriptions

### Phase 6 — Programmes + Automatisations (vers isna-opus, 2 semaines)
1. Migration `med_programs` complète
2. `CareProgramModule` avec 5 templates seeds
3. Worker automatisations (cron J+N)
4. Emails/SMS rappels

### Phase 7 — Compliance, Tests, Lancement (1-2 semaines)
1. Tests E2E complets MedOS
2. Swagger/OpenAPI
3. Export RGPD JSON + PDF
4. Alignement pages marketing
5. Runbooks incidents

---

## 14. Tâches DeepSeek possibles

Tâches non-critiques (volume, pas de sécurité directe) que DeepSeek V4 Pro/Flash peut exécuter :

| Tâche | Agent |
|---|---|
| DTOs avec class-validator pour les 8 modules | Pro |
| Seeds de templates (formulaires, programmes) | Flash |
| Scaffold `apps/med-app` (structure vide) | Pro |
| Scaffold `apps/patient-portal` (structure vide) | Pro |
| Documentation OpenAPI/Swagger | Flash |
| Tests unitaires simples (cas nominaux) | Pro |
| Scripts de migration de données test | Flash |
| UI dashboard praticien (pages statiques) | Pro |
| UI portail patient (pages statiques) | Pro |

---

## 15. Tâches Codex/Opus obligatoires

Tâches critiques (sécurité, conformité, données de santé) :

| Tâche | Agent |
|---|---|
| Design RBAC médical complet (qui peut quoi) | Opus |
| Design RLS policies médicales | Sonnet |
| `RolesGuard` + `@Roles` sur tous les endpoints | Sonnet |
| `MedAuditInterceptor` + log obligatoire | Sonnet |
| Vérification conformité RGPD (consentement, rétention, portabilité) | Opus |
| Revue de sécurité des schémas SQL finaux | Sonnet |
| Intégration Stripe Checkout médical (réel, pas placeholder) | Sonnet |
| Intégration LiveKit téléconsultation (réelle) | Sonnet |
| Chiffrement AES-256-GCM données sensibles | Sonnet |
| Review finale avant mise en production | Opus |

---

## 16. Critères de « MedOS livrable »

MedOS est considéré **livrable** quand TOUS ces critères sont remplis :

- [ ] RBAC médical appliqué sur 100% des endpoints
- [ ] RLS par rôle activée sur toutes les tables médicales
- [ ] `MedAuditInterceptor` loggue chaque accès/donnée médicale
- [ ] Tous les `@Body()` sont des DTOs validés (class-validator)
- [ ] 0 placeholder dans le code (Deepgram, Claude, LiveKit, Stripe réels)
- [ ] 0 bug critique (charting insert, gdpr anonymize)
- [ ] Tests unitaires : ≥80% coverage sur modules médicaux
- [ ] Tests E2E : scénario praticien-patient complet
- [ ] Portail patient fonctionnel avec isolation patient A/B vérifiée
- [ ] Export RGPD JSON + PDF fonctionnel
- [ ] Consentement explicite patient enregistré en base
- [ ] Secrets nettoyés du repo (rotation faite)
- [ ] Pages marketing alignées avec l'état réel du produit
- [ ] Swagger/OpenAPI documenté
- [ ] Runbook incident médical rédigé

---

## 17. Prochaine tâche concrète

**Action immédiate recommandée** : Nettoyage de sécurité du repo `isna_platform_v2`

1. Rotater la clé service-role Supabase exposée dans `scripts/e2e_test.js`
2. Ajouter `.gitignore` racine (`.env`, `node_modules`, `dist`, `.next`)
3. `git rm --cached` sur les fichiers sensibles trackés
4. Vérifier `git log` pour toute exposition antérieure
5. Corriger les 2 bugs critiques (med-charting insert, med-gdpr anonymize)
6. Ajouter `@Roles()` + `RolesGuard` sur les contrôleurs med-ehr et med-notes

**Cette phase de nettoyage est le prérequis absolu avant toute migration vers isna-opus.**

---

## Résumé exécutif

### Ce qui est déjà fait
- Socle Cimolace stable dans `isna-opus` : auth, tenant, catalogue, onboarding, paiement live
- Prototype MedOS dans `isna_platform_v2` : 8 modules NestJS avec CRUD médical de base, 3 migrations SQL
- Cahier des charges MedOS complet et validé
- Benchmark Practice Better documenté

### Ce qui manque
- Sécurité médicale (RBAC, RLS, audit) : **95% manquant**
- Frontend praticien et patient : **100% manquant**
- Worker IA/PDF/automatisations : **100% manquant**
- Tests : **100% manquant**
- Compliance RGPD : **90% manquant**

### Niveau de risque
**CRITIQUE** — Le code actuel ne doit en aucun cas être exposé à des données médicales réelles. Risques de violation RGPD, d'exposition de secrets, et de corruption de données.

### MedOS peut-il être migré maintenant ?
**NON.** La migration ne doit commencer qu'après :
1. Nettoyage de sécurité du repo `isna_platform_v2`
2. Correction des 2 bugs critiques
3. Implémentation de RBAC + audit sur au moins med-ehr et med-notes

### Prochaine action recommandée
Exécuter la Phase 1 (Stabilisation sécurité MedOS dans `isna_platform_v2`), puis migrer le module EHR + Notes vers `isna-opus` (Phase 2) en respectant le pattern RBAC/audit/RLS déjà prouvé.
