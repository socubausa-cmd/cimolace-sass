-- Migration: formation studio tables (modules, formation_weeks, formation_days, formation_day_contents)
-- Used by useFormationStructure.js (buildDbInserts), VideoPostProductionPage.jsx,
-- and OwnerDashboardOverview.jsx in the LIRI formation studio.
-- Dependency order: liri_formations → modules → formation_weeks → formation_days → formation_day_contents
--
-- Also patches annual_program_weeks with three columns consumed by ai-utils.service.ts
-- (theme, pedagogical_objective, liri_segments, cimolace_tenant_id).

-- ─── Extensions ───────────────────────────────────────────────────────────────
-- moddatetime is used for updated_at auto-refresh on INSERT-less UPDATE triggers.
-- It may already exist; the CREATE EXTENSION IF NOT EXISTS is safe to re-run.
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ─── 1. public.modules ────────────────────────────────────────────────────────
COMMENT ON TABLE public.modules IS
  'Modules belonging to a LIRI formation. '
  'Each module groups one or more formation_weeks.';

CREATE TABLE IF NOT EXISTS public.modules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id UUID       NOT NULL REFERENCES public.liri_formations(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT '',
  description TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'locked',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.modules IS
  'Modules belonging to a LIRI formation; each groups ordered formation_weeks.';

CREATE INDEX IF NOT EXISTS idx_modules_formation_id
  ON public.modules (formation_id);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Members (any active role) may read modules via their formation.
DROP POLICY IF EXISTS modules_select_authenticated ON public.modules;
CREATE POLICY modules_select_authenticated ON public.modules
  FOR SELECT TO authenticated
  USING (TRUE);

-- Staff manage modules (insert / update / delete).
DROP POLICY IF EXISTS modules_manage_staff ON public.modules;
CREATE POLICY modules_manage_staff ON public.modules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.liri_formations lf ON lf.id = public.modules.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.liri_formations lf ON lf.id = public.modules.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  );

-- ─── 2. public.formation_weeks ────────────────────────────────────────────────
COMMENT ON TABLE public.formation_weeks IS
  'Weeks within a module, ordered by sort_order.';

CREATE TABLE IF NOT EXISTS public.formation_weeks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  UUID        NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_weeks_module_id
  ON public.formation_weeks (module_id);

ALTER TABLE public.formation_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formation_weeks_select_authenticated ON public.formation_weeks;
CREATE POLICY formation_weeks_select_authenticated ON public.formation_weeks
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS formation_weeks_manage_staff ON public.formation_weeks;
CREATE POLICY formation_weeks_manage_staff ON public.formation_weeks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.modules            m  ON m.id  = public.formation_weeks.module_id
      JOIN public.liri_formations    lf ON lf.id = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.modules            m  ON m.id  = public.formation_weeks.module_id
      JOIN public.liri_formations    lf ON lf.id = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  );

-- ─── 3. public.formation_days ─────────────────────────────────────────────────
COMMENT ON TABLE public.formation_days IS
  'Days within a formation week, ordered by sort_order.';

CREATE TABLE IF NOT EXISTS public.formation_days (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id    UUID        NOT NULL REFERENCES public.formation_weeks(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_days_week_id
  ON public.formation_days (week_id);

ALTER TABLE public.formation_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formation_days_select_authenticated ON public.formation_days;
CREATE POLICY formation_days_select_authenticated ON public.formation_days
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS formation_days_manage_staff ON public.formation_days;
CREATE POLICY formation_days_manage_staff ON public.formation_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.formation_weeks    fw ON fw.id  = public.formation_days.week_id
      JOIN public.modules            m  ON m.id   = fw.module_id
      JOIN public.liri_formations    lf ON lf.id  = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.formation_weeks    fw ON fw.id  = public.formation_days.week_id
      JOIN public.modules            m  ON m.id   = fw.module_id
      JOIN public.liri_formations    lf ON lf.id  = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  );

-- ─── 4. public.formation_day_contents ─────────────────────────────────────────
-- day_id is nullable: some content rows are standalone and referenced only by
-- UUID from tables such as neuro_recall_cards and course_postprod_versions.
COMMENT ON TABLE public.formation_day_contents IS
  'Content items (video, powerpoint, quiz, …) attached to a formation day. '
  'day_id is nullable to allow standalone content referenced by UUID from other tables.';

CREATE TABLE IF NOT EXISTS public.formation_day_contents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id     UUID        REFERENCES public.formation_days(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'video',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_day_contents_day_id
  ON public.formation_day_contents (day_id);

ALTER TABLE public.formation_day_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formation_day_contents_select_authenticated ON public.formation_day_contents;
CREATE POLICY formation_day_contents_select_authenticated ON public.formation_day_contents
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS formation_day_contents_manage_staff ON public.formation_day_contents;
CREATE POLICY formation_day_contents_manage_staff ON public.formation_day_contents
  FOR ALL TO authenticated
  USING (
    -- Standalone content (day_id IS NULL) is managed by any authenticated staff;
    -- day-scoped content requires tenant membership via the formation chain.
    public.formation_day_contents.day_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.formation_days     fd ON fd.id  = public.formation_day_contents.day_id
      JOIN public.formation_weeks    fw ON fw.id  = fd.week_id
      JOIN public.modules            m  ON m.id   = fw.module_id
      JOIN public.liri_formations    lf ON lf.id  = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  )
  WITH CHECK (
    public.formation_day_contents.day_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.formation_days     fd ON fd.id  = public.formation_day_contents.day_id
      JOIN public.formation_weeks    fw ON fw.id  = fd.week_id
      JOIN public.modules            m  ON m.id   = fw.module_id
      JOIN public.liri_formations    lf ON lf.id  = m.formation_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lf.tenant_id
        AND tm.status    = 'active'
        AND tm.role IN ('owner', 'admin', 'creator', 'teacher')
    )
  );

-- ─── updated_at triggers (modules + formation_day_contents) ───────────────────
-- Reuse the generic set_updated_at function if it exists, otherwise create one.
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $body$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $body$;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modules_updated_at ON public.modules;
CREATE TRIGGER trg_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_formation_day_contents_updated_at ON public.formation_day_contents;
CREATE TRIGGER trg_formation_day_contents_updated_at
  BEFORE UPDATE ON public.formation_day_contents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Patch annual_program_weeks ────────────────────────────────────────────
-- Three columns used by ai-utils.service.ts (lines 301-308) are absent from the
-- original DDL in 20260528170001_courses_extended_calendar.sql.
ALTER TABLE public.annual_program_weeks
  ADD COLUMN IF NOT EXISTS theme                 TEXT,
  ADD COLUMN IF NOT EXISTS pedagogical_objective TEXT,
  ADD COLUMN IF NOT EXISTS liri_segments         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cimolace_tenant_id    UUID;
