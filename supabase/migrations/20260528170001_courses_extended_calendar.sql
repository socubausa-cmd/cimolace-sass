-- Migration: extend courses table + create school_year_calendars + annual_program_weeks
-- Applied: 2026-05-28

-- ─── 1. courses — add missing columns for admin management ───────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cycle TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_weeks INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- ─── 2. school_year_calendars ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_year_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cimolace_tenant_id UUID REFERENCES tenants(id),
  school_year TEXT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'fondements',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cimolace_tenant_id, school_year, cycle)
);

CREATE INDEX IF NOT EXISTS idx_syc_tenant ON school_year_calendars(cimolace_tenant_id);
CREATE INDEX IF NOT EXISTS idx_syc_year ON school_year_calendars(school_year);

ALTER TABLE school_year_calendars ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY syc_authenticated_select ON school_year_calendars
    FOR SELECT TO authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. annual_program_weeks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_program_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES school_year_calendars(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  title TEXT,
  session_type TEXT DEFAULT 'cours'
    CHECK (session_type IN ('cours', 'live', 'atelier', 'evaluation', 'revision', 'conge')),
  is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed')),
  module_number INTEGER,
  module_title TEXT,
  description TEXT,
  live_session_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_apw_calendar ON annual_program_weeks(calendar_id);
CREATE INDEX IF NOT EXISTS idx_apw_week ON annual_program_weeks(week_start);

ALTER TABLE annual_program_weeks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY apw_authenticated_select ON annual_program_weeks
    FOR SELECT TO authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY apw_authenticated_update ON annual_program_weeks
    FOR UPDATE TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
