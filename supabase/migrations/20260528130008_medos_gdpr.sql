-- MEDOS — RGPD : consentement, export, anonymisation
--
-- Triple table pour satisfaire les obligations RGPD :
--   1. med_consent_records  — chaque consentement donné par un patient
--      (général, partage, IA charting, recherche). Granularité par scope.
--   2. med_gdpr_exports     — chaque demande d'export par le patient
--      (droit d'accès / portabilité). Track généré, téléchargé, expiré.
--   3. med_gdpr_anonymizations — chaque opération d'anonymisation
--      (droit à l'oubli). Append-only, pour traçabilité.

-- ─── Consentements granulaires ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  scope TEXT NOT NULL
    CHECK (scope IN (
      'general_care',
      'data_processing',
      'data_sharing_practitioners',
      'data_sharing_research',
      'ai_charting',
      'teleconsult_recording',
      'marketing_communications',
      'third_party_integration'
    )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,

  -- Preuve
  consent_text TEXT NOT NULL,                         -- texte exact présenté au patient
  consent_version TEXT NOT NULL,                      -- version du document
  ip_address TEXT,
  user_agent TEXT,
  signature_data TEXT,                                -- base64 signature dessinée si applicable

  -- Méta
  recorded_via TEXT NOT NULL DEFAULT 'web'
    CHECK (recorded_via IN ('web','widget','paper','phone','api')),
  related_form_response_id UUID REFERENCES med_form_responses(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_consents_tenant ON med_consent_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_consents_patient
  ON med_consent_records(patient_id, scope, granted_at DESC);
-- Vue : dernier consentement effectif par (patient, scope)
CREATE INDEX IF NOT EXISTS idx_med_consents_latest
  ON med_consent_records(patient_id, scope, revoked_at)
  WHERE revoked_at IS NULL;

ALTER TABLE med_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_consents" ON med_consent_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consent_records.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_consents" ON med_consent_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_consent_records.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_grant_own_consent" ON med_consent_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_consent_records.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_consents" ON med_consent_records
  TO service_role USING (true) WITH CHECK (true);

-- No UPDATE / DELETE policy : un consentement ne se modifie pas. Pour
-- "révoquer" on UPDATE revoked_at via service_role uniquement, ou on insère
-- un nouveau record avec granted=false.

-- ─── Demandes d'export RGPD ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_gdpr_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,                         -- user_id du patient (auth.uid)
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','ready','downloaded','expired','failed')),

  format TEXT NOT NULL DEFAULT 'json'
    CHECK (format IN ('json','pdf','zip')),
  scope TEXT NOT NULL DEFAULT 'full'
    CHECK (scope IN ('full','medical_only','administrative_only','custom')),
  custom_scope JSONB,                                 -- si scope='custom'

  -- Résultat
  file_url TEXT,
  file_size_bytes BIGINT,
  file_sha256 TEXT,
  expires_at TIMESTAMPTZ,                             -- URL signée temporaire
  downloaded_at TIMESTAMPTZ,
  downloaded_ip TEXT,

  error_message TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,                                  -- staff ou worker

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_exports_tenant ON med_gdpr_exports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_exports_patient
  ON med_gdpr_exports(patient_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_exports_status
  ON med_gdpr_exports(status, requested_at)
  WHERE status IN ('pending','processing');

ALTER TABLE med_gdpr_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_exports" ON med_gdpr_exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_gdpr_exports.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_exports" ON med_gdpr_exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_gdpr_exports.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_request_own_export" ON med_gdpr_exports
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_gdpr_exports.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_exports" ON med_gdpr_exports
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_gdpr_exports_updated_at ON med_gdpr_exports;
CREATE TRIGGER med_gdpr_exports_updated_at
  BEFORE UPDATE ON med_gdpr_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Anonymisations (droit à l'oubli) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_gdpr_anonymizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identifiants AVANT anonymisation. Le patient_id reste, mais ses données
  -- PII sont remplacées par des hash / strings vides.
  original_patient_id UUID NOT NULL,
  original_patient_user_id UUID,                      -- snapshot pour audit
  pseudonym TEXT NOT NULL,                            -- ex: "PATIENT_ANON_8f3b…"

  requested_by UUID NOT NULL,
  requested_by_role TEXT NOT NULL
    CHECK (requested_by_role IN ('patient','clinic_admin','owner','legal','court_order')),
  legal_basis TEXT NOT NULL,                          -- ex: "Demande patient article 17 RGPD"
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Méthode appliquée
  method TEXT NOT NULL DEFAULT 'pseudonymization'
    CHECK (method IN ('pseudonymization','full_deletion','partial_deletion')),
  scope TEXT NOT NULL DEFAULT 'full'
    CHECK (scope IN ('full','identifiers_only','medical_only')),

  -- Compte rendu
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','reverted')),
  tables_affected JSONB NOT NULL DEFAULT '[]',        -- ex: [{"table":"med_patients","rows":1}]
  rows_affected INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  error_message TEXT,

  -- Vérification (recommandé : 2e personne valide)
  verified_by UUID,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_anon_tenant ON med_gdpr_anonymizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_anon_patient ON med_gdpr_anonymizations(original_patient_id);
CREATE INDEX IF NOT EXISTS idx_med_anon_status
  ON med_gdpr_anonymizations(status, requested_at)
  WHERE status IN ('pending','processing');

ALTER TABLE med_gdpr_anonymizations ENABLE ROW LEVEL SECURITY;

-- Seul le staff "owner" / "clinic_admin" peut voir/déclencher des anonymisations
CREATE POLICY "owner_admin_manage_anonymizations" ON med_gdpr_anonymizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_gdpr_anonymizations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_gdpr_anonymizations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "service_role_anonymizations" ON med_gdpr_anonymizations
  TO service_role USING (true) WITH CHECK (true);

-- Le patient ne voit PAS la table d'anonymisation (par design)
