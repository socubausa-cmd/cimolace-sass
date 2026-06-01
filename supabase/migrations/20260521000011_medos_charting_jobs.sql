-- MedOS AI Charting Jobs
-- Tracks async transcription + SOAP generation jobs.
-- Each job is created when a practitioner starts charting,
-- updated as the pipeline progresses, and read by GET /med/charting/status/:jobId.

CREATE TABLE IF NOT EXISTS med_charting_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  note_id UUID REFERENCES med_consultation_notes(id) ON DELETE SET NULL,
  practitioner_id UUID NOT NULL,

  -- Pipeline stages: pending → transcribing → generating → completed | failed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'transcribing', 'generating', 'completed', 'failed')),

  -- Input
  audio_url TEXT,                   -- URL du fichier audio (Supabase Storage ou R2)
  raw_transcript TEXT,              -- texte brut retourné par Deepgram

  -- Output IA
  soap_subjective TEXT,
  soap_objective TEXT,
  soap_assessment TEXT,
  soap_plan TEXT,
  soap_free_text TEXT,
  icd10_suggestions JSONB DEFAULT '[]',  -- [{"code":"J06.9","description":"URTI"}]

  -- Provider metadata
  transcription_provider TEXT DEFAULT 'deepgram',
  generation_provider TEXT DEFAULT 'anthropic',
  model_used TEXT,
  tokens_used INTEGER,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_charting_tenant ON med_charting_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_charting_patient ON med_charting_jobs(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_charting_practitioner ON med_charting_jobs(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_med_charting_status ON med_charting_jobs(tenant_id, status);

ALTER TABLE med_charting_jobs ENABLE ROW LEVEL SECURITY;

-- Praticien / clinic_admin : créer et lire leurs propres jobs
CREATE POLICY "practitioner_manage_charting_jobs" ON med_charting_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = med_charting_jobs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'practitioner', 'clinic_admin')
        AND tm.status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = med_charting_jobs.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'practitioner', 'clinic_admin')
        AND tm.status = 'active'
    )
  );

-- service_role pour les workers internes
CREATE POLICY "service_role_charting_jobs" ON med_charting_jobs
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_charting_jobs_updated_at ON med_charting_jobs;
CREATE TRIGGER med_charting_jobs_updated_at
  BEFORE UPDATE ON med_charting_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
