-- MedOS Patient Note Reads — Phase 1A+
-- Persist patient read acknowledgements for shared consultation notes.

CREATE TABLE IF NOT EXISTS med_note_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES med_consultation_notes(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, note_id, patient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_med_note_reads_tenant_patient
  ON med_note_reads(tenant_id, patient_user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_med_note_reads_note
  ON med_note_reads(note_id);

ALTER TABLE med_note_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_note_reads" ON med_note_reads;
CREATE POLICY "service_role_full_access_note_reads" ON med_note_reads
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_note_reads_updated_at ON med_note_reads;
CREATE TRIGGER med_note_reads_updated_at
  BEFORE UPDATE ON med_note_reads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
