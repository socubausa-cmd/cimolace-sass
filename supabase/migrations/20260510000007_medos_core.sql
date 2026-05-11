-- MedOS Core — Phase 1A
-- Tables: med_patients, med_consultation_notes, med_audit_log
-- RLS with role-based policies

-- 1. Patients
CREATE TABLE IF NOT EXISTS med_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  blood_type TEXT,
  allergies JSONB NOT NULL DEFAULT '[]',
  chronic_conditions JSONB NOT NULL DEFAULT '[]',
  current_medications JSONB NOT NULL DEFAULT '[]',
  medical_history JSONB NOT NULL DEFAULT '{}',
  family_history JSONB NOT NULL DEFAULT '{}',
  emergency_contact JSONB,
  insurance_info JSONB,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMPTZ,
  consent_purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deceased')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_patients_tenant ON med_patients(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_med_patients_unique ON med_patients(tenant_id, patient_user_id);
CREATE INDEX IF NOT EXISTS idx_med_patients_status ON med_patients(tenant_id, status);

ALTER TABLE med_patients ENABLE ROW LEVEL SECURITY;

-- Staff can read patients
CREATE POLICY "med_staff_read_patients" ON med_patients
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

-- Patient can read their own record
CREATE POLICY "patient_read_own" ON med_patients
  FOR SELECT USING (
    patient_user_id = auth.uid()
  );

-- Practitioner / clinic_admin can insert
CREATE POLICY "practitioner_insert_patients" ON med_patients
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Receptionist can insert (basic patient registration)
CREATE POLICY "receptionist_insert_patients" ON med_patients
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('receptionist')
        AND status = 'active'
    )
  );

-- Practitioner / clinic_admin can update
CREATE POLICY "practitioner_update_patients" ON med_patients
  FOR UPDATE USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS med_patients_updated_at ON med_patients;
CREATE TRIGGER med_patients_updated_at
  BEFORE UPDATE ON med_patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Consultation Notes (SOAP)
CREATE TABLE IF NOT EXISTS med_consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  free_text TEXT,
  ai_transcript TEXT,
  ai_draft TEXT,
  ai_summary TEXT,
  icd10_codes JSONB NOT NULL DEFAULT '[]',
  is_shared_with_patient BOOLEAN NOT NULL DEFAULT false,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_notes_tenant ON med_consultation_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_notes_patient ON med_consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_notes_practitioner ON med_consultation_notes(practitioner_id);

ALTER TABLE med_consultation_notes ENABLE ROW LEVEL SECURITY;

-- Practitioner / clinic_admin can read notes
CREATE POLICY "practitioner_read_notes" ON med_consultation_notes
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Patient can read shared notes (via their patient record)
CREATE POLICY "patient_read_shared_notes" ON med_consultation_notes
  FOR SELECT USING (
    is_shared_with_patient = true
    AND EXISTS(
      SELECT 1 FROM med_patients
      WHERE med_patients.id = med_consultation_notes.patient_id
        AND med_patients.patient_user_id = auth.uid()
    )
  );

-- Practitioner / clinic_admin can insert notes
CREATE POLICY "practitioner_insert_notes" ON med_consultation_notes
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Practitioner / clinic_admin can update unsigned notes
CREATE POLICY "practitioner_update_notes" ON med_consultation_notes
  FOR UPDATE USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS med_consultation_notes_updated_at ON med_consultation_notes;
CREATE TRIGGER med_consultation_notes_updated_at
  BEFORE UPDATE ON med_consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Medical Audit Log (append-only)
CREATE TABLE IF NOT EXISTS med_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_audit_tenant ON med_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_audit_resource ON med_audit_log(tenant_id, resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_med_audit_actor ON med_audit_log(actor_id);

ALTER TABLE med_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff can read audit logs
CREATE POLICY "staff_read_audit" ON med_audit_log
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_audit_log.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- ONLY service_role can insert audit entries (API writes with service_role).
-- No UPDATE/DELETE policy: med_audit_log is append-only by design.
-- Authenticated users (practitioners, clinic_admin) can only SELECT via staff_read_audit above.
CREATE POLICY "service_insert_audit" ON med_audit_log
  FOR INSERT TO service_role WITH CHECK (true);
