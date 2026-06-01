-- Migration: sms_engine
-- Logs SMS (Twilio) et WhatsApp Business par tenant.

-- ── SMS_LOGS ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sms_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_number   TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','undelivered')),
  provider_id TEXT,  -- SID Twilio renvoyé après envoi
  error_code  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant ON sms_logs(tenant_id, created_at DESC);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_logs_admin"
  ON sms_logs FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

-- ── WHATSAPP_LOGS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_number   TEXT NOT NULL,
  template    TEXT NOT NULL,     -- clé template WhatsApp Business
  params      TEXT[],            -- paramètres du template
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  provider_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_tenant ON whatsapp_logs(tenant_id, created_at DESC);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_logs_admin"
  ON whatsapp_logs FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

COMMENT ON TABLE sms_logs IS 'Logs d''envoi SMS via Twilio par tenant.';
COMMENT ON TABLE whatsapp_logs IS 'Logs d''envoi WhatsApp Business (templates) par tenant.';
