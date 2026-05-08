-- MedOS: Forms, Health, Programs, Prescriptions
CREATE TABLE medical_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('intake','assessment','consent','followup','custom')),
  fields JSONB NOT NULL,
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES medical_forms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  record_id UUID REFERENCES patient_records(id) ON DELETE SET NULL,
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE medical_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON medical_forms TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON form_responses TO service_role USING (true) WITH CHECK (true);

CREATE TABLE health_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('mood','sleep','vitals','food','activity','symptom','custom')),
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  sleep_hours DECIMAL(4,1),
  weight_kg DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_health_patient ON health_entries(tenant_id, patient_user_id, entry_date DESC);
ALTER TABLE health_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON health_entries TO service_role USING (true) WITH CHECK (true);

CREATE TABLE care_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER DEFAULT 30,
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE care_program_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES care_programs(id) ON DELETE CASCADE,
  day_offset INTEGER DEFAULT 0,
  step_type TEXT CHECK (step_type IN ('message','form','task','reminder','checkin')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE patient_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES care_programs(id),
  patient_id UUID NOT NULL,
  record_id UUID REFERENCES patient_records(id),
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  progress_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE care_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_program_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON care_programs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON care_program_steps TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON patient_programs TO service_role USING (true) WITH CHECK (true);

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES patient_records(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  type TEXT CHECK (type IN ('medication','supplement','lab','referral','diet','imaging','other')),
  items JSONB NOT NULL,
  instructions TEXT,
  valid_until DATE,
  is_signed BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prescriptions_tenant ON prescriptions(tenant_id, record_id);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON prescriptions TO service_role USING (true) WITH CHECK (true);
