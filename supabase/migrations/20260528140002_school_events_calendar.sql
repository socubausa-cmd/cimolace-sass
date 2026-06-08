-- Migration: school_events + school_calendar tables
-- Nécessaires pour l'agenda mobile LIRI (useLiriMobileAgendaMerged).
-- Applied: 2026-05-28

CREATE TABLE IF NOT EXISTS school_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  location TEXT,
  target_role TEXT NOT NULL DEFAULT 'student'
    CHECK (target_role IN ('student', 'teacher', 'admin', 'all')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_events_tenant ON school_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_events_start ON school_events(start_at);

ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_read ON school_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY admins_manage ON school_events
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','owner') AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','owner') AND status = 'active'
    )
  );

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'period'
    CHECK (type IN ('period', 'holiday', 'exam', 'event')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_calendar_tenant ON school_calendar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_calendar_dates ON school_calendar(start_date, end_date);

ALTER TABLE school_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_read ON school_calendar
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
