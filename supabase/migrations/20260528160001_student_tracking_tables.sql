-- Migration: student tracking tables
-- Creates attendance_records, student_evaluations, student_live_reports, certificates
-- Applied: 2026-05-28

-- ─── 1. attendance_records ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused')),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(student_id, status);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY attendance_student_select ON attendance_records
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. student_evaluations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id UUID,
  title TEXT NOT NULL DEFAULT 'Évaluation',
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 20,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_student ON student_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_date ON student_evaluations(student_id, evaluated_at DESC);

ALTER TABLE student_evaluations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY evaluations_student_select ON student_evaluations
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. student_live_reports ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_live_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
  report_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_reports_student ON student_live_reports(student_id);

ALTER TABLE student_live_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY live_reports_student_select ON student_live_reports
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. certificates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Certificat',
  file_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY certificates_student_select ON certificates
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
