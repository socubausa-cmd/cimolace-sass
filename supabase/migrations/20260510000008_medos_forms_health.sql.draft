-- ============================================================================
-- MedOS Phase 1B — Forms & Health Tracking (BROUILLON — NE PAS APPLIQUER)
-- Statut : non validé, non audité, routes API désactivées dans MedosModule.
-- Sera revu et potentiellement refondu lors de la Phase 1B après validation
-- du socle Phase 1A (patients + notes + audit).
-- ============================================================================
-- Tables: med_medical_forms, med_form_responses, med_health_entries

-- 1. Medical Forms
CREATE TABLE IF NOT EXISTS med_medical_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('intake','assessment','consent','followup','custom')),
  fields JSONB NOT NULL DEFAULT '[]',
  is_template BOOLEAN NOT NULL DEFAULT false,
  send_before_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_forms_tenant ON med_medical_forms(tenant_id);

ALTER TABLE med_medical_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_forms" ON med_medical_forms
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active')
  );

CREATE POLICY "staff_manage_forms" ON med_medical_forms
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

DROP TRIGGER IF EXISTS med_medical_forms_updated_at ON med_medical_forms;
CREATE TRIGGER med_medical_forms_updated_at
  BEFORE UPDATE ON med_medical_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Form Responses
CREATE TABLE IF NOT EXISTS med_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES med_medical_forms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_fr_tenant ON med_form_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_fr_form ON med_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_med_fr_patient ON med_form_responses(patient_id);

ALTER TABLE med_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_responses" ON med_form_responses
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_responses.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

CREATE POLICY "patient_read_own_responses" ON med_form_responses
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_form_responses.patient_id
        AND med_patients.patient_user_id = auth.uid())
  );

CREATE POLICY "staff_patient_insert_responses" ON med_form_responses
  FOR INSERT WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_responses.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','patient')
        AND status = 'active')
  );

-- 3. Health Entries (daily journal)
CREATE TABLE IF NOT EXISTS med_health_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL DEFAULT 'custom' CHECK (entry_type IN ('mood','sleep','vitals','food','activity','symptom','custom')),
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  sleep_hours DECIMAL(4,1),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  weight_kg DECIMAL(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  blood_glucose DECIMAL(5,1),
  temperature DECIMAL(4,1),
  meal_photos JSONB DEFAULT '[]',
  food_notes TEXT,
  water_liters DECIMAL(4,2),
  steps INTEGER,
  exercise_minutes INTEGER,
  symptoms JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_health_tenant ON med_health_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_health_patient ON med_health_entries(patient_id, entry_date DESC);

ALTER TABLE med_health_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_read_health" ON med_health_entries
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_health_entries.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

CREATE POLICY "patient_manage_own_health" ON med_health_entries
  FOR ALL USING (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_health_entries.patient_id
        AND med_patients.patient_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_health_entries.patient_id
        AND med_patients.patient_user_id = auth.uid())
  );
