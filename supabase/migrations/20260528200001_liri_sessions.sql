-- ============================================================================
-- LIRI — Sessions ledger (single video authority across engines)
-- ============================================================================
-- Why: Liri is the unique video pipeline shared by MEDOS (téléconsult),
-- Mbolo (live shopping), ISNA (classes). To keep that promise concrete, every
-- token issuance writes a row here. Aggregating this table gives the tenant a
-- unified "video minutes consumed" view regardless of which engine triggered
-- the call.
--
-- Why a NEW table instead of reusing live_sessions: live_sessions is owned by
-- the ISNA school flow (has scheduled_at, scheduled events, class metadata).
-- Cross-engine billing needs a leaner, generic ledger.
-- ============================================================================

CREATE TABLE IF NOT EXISTS liri_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Free-form so new engines can add purposes without a schema migration.
  -- Known values today: 'school_class', 'medical_teleconsult',
  -- 'live_shopping', 'support_call'.
  purpose TEXT NOT NULL,

  -- The caller's stable identifier (e.g. med_teleconsult_sessions.id).
  -- Same external_ref = same LiveKit room = reuses the same Liri session row.
  external_ref TEXT NOT NULL,

  -- The LiveKit room name (derived from tenantSlug + externalRef). Stored so
  -- audits can correlate Liri logs with LiveKit webhook events.
  room_name TEXT NOT NULL,

  -- The user who initiated this session (host). Guests joining the same
  -- external_ref do not create a new row, they share the host's session.
  host_user_id UUID NOT NULL,

  -- Lifecycle timestamps. duration_seconds is computed at end time.
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Optional metadata blob — kept opaque to allow callers to attach domain
  -- context (appointment_id, product_id, …) without ad-hoc columns.
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (tenant, external_ref) — re-joining the same session reuses it.
CREATE UNIQUE INDEX IF NOT EXISTS liri_sessions_unique_ref
  ON liri_sessions (tenant_id, external_ref);

CREATE INDEX IF NOT EXISTS liri_sessions_tenant_purpose
  ON liri_sessions (tenant_id, purpose, started_at DESC);

CREATE INDEX IF NOT EXISTS liri_sessions_tenant_active
  ON liri_sessions (tenant_id) WHERE ended_at IS NULL;

ALTER TABLE liri_sessions ENABLE ROW LEVEL SECURITY;

-- Service role only — billing data is sensitive, the API mediates all reads.
DROP POLICY IF EXISTS "liri_sessions_service_role" ON liri_sessions;
CREATE POLICY "liri_sessions_service_role" ON liri_sessions
  TO service_role
  USING (true) WITH CHECK (true);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION liri_sessions_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liri_sessions_touch ON liri_sessions;
CREATE TRIGGER liri_sessions_touch
  BEFORE UPDATE ON liri_sessions
  FOR EACH ROW EXECUTE FUNCTION liri_sessions_touch_updated_at();
