-- ─────────────────────────────────────────────────────────────────────────────
-- LIRI Webhooks — événements sortants vers les sites clients
-- Chaque tenant peut enregistrer N endpoints HTTPS qui reçoivent les events
-- live (session.started, participant.joined, recording.completed, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  url           TEXT NOT NULL,               -- HTTPS endpoint du client
  secret        TEXT NOT NULL,               -- HMAC-SHA256 signing secret
  events        TEXT[] NOT NULL DEFAULT '{}', -- ex: ['session.started','recording.completed']
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  last_status   INT,                         -- HTTP status du dernier appel
  failure_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant   ON tenant_webhooks(tenant_id);
CREATE INDEX idx_webhooks_active   ON tenant_webhooks(tenant_id, is_active);

ALTER TABLE tenant_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON tenant_webhooks TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON tenant_webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tenant_webhooks IS
  'Webhook endpoints enregistrés par chaque tenant pour recevoir les événements LIRI Live (session.started, participant.joined, recording.completed…).';
