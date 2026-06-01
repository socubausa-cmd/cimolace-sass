-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 36 : provider health-checks + incidents Cimolace
-- Tables : cimolace_provider_health_checks, cimolace_provider_incidents
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Health checks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cimolace_provider_health_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES cimolace_clients(id) ON DELETE CASCADE,
  provider_key    text NOT NULL,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'unknown' CHECK (status IN ('ok','warn','fail','unknown')),
  latency_ms      integer,
  error_message   text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_client_provider
  ON cimolace_provider_health_checks(client_id, provider_key, checked_at DESC);

-- ── Incidents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cimolace_provider_incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES cimolace_clients(id) ON DELETE CASCADE,
  provider_key  text NOT NULL,
  title         text NOT NULL,
  description   text,
  severity      text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved      boolean NOT NULL DEFAULT false,
  ticket_id     uuid REFERENCES cimolace_tickets(id) ON DELETE SET NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_incidents_client_provider
  ON cimolace_provider_incidents(client_id, provider_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_incidents_unresolved
  ON cimolace_provider_incidents(client_id, resolved) WHERE resolved = false;

-- RLS
ALTER TABLE cimolace_provider_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_provider_incidents ENABLE ROW LEVEL SECURITY;

-- Staff Cimolace uniquement (accès via service_role dans l'API)
CREATE POLICY "service_role_health_checks" ON cimolace_provider_health_checks
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_incidents" ON cimolace_provider_incidents
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
