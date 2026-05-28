-- ============================================================================
-- MEDOS — Patient records: add denormalized identity columns
-- ============================================================================
-- Why: legacy patient_records only stored patient_user_id (FK to auth.users)
-- and joined to fetch first_name/last_name. To allow doctors to create patient
-- dossiers WITHOUT immediately provisioning an auth account (invitation comes
-- later), we add denormalized identity columns directly on the record.
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is safe.
-- ============================================================================

ALTER TABLE patient_records
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT;

-- Index for name search (case-insensitive prefix match)
CREATE INDEX IF NOT EXISTS idx_patient_records_name
  ON patient_records (lower(last_name), lower(first_name));

-- Relax patient_user_id constraint to support draft dossiers (pre-invitation)
ALTER TABLE patient_records
  ALTER COLUMN patient_user_id DROP NOT NULL;
