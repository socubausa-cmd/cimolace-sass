-- MedOS: Patient Records (EHR)
CREATE TABLE patient_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other')),
  blood_type TEXT,
  allergies JSONB DEFAULT '[]',
  chronic_conditions JSONB DEFAULT '[]',
  current_medications JSONB DEFAULT '[]',
  medical_history JSONB DEFAULT '{}',
  family_history JSONB DEFAULT '{}',
  emergency_contact JSONB,
  insurance_info JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','archived','deceased')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_patient_tenant ON patient_records(tenant_id);
CREATE UNIQUE INDEX idx_patient_unique ON patient_records(tenant_id, patient_user_id);
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON patient_records TO service_role USING (true) WITH CHECK (true);

-- MedOS: Consultation Notes (SOAP)
CREATE TABLE consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES patient_records(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  free_text TEXT,
  ai_transcript TEXT,
  ai_draft TEXT,
  icd10_codes JSONB DEFAULT '[]',
  is_shared_with_patient BOOLEAN DEFAULT FALSE,
  is_signed BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_tenant ON consultation_notes(tenant_id);
CREATE INDEX idx_notes_record ON consultation_notes(record_id);
ALTER TABLE consultation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON consultation_notes TO service_role USING (true) WITH CHECK (true);

-- MedOS: Audit Log (append-only)
CREATE TABLE medical_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant ON medical_audit_log(tenant_id);
ALTER TABLE medical_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON medical_audit_log TO service_role USING (true) WITH CHECK (true);
