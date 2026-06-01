-- Migration: email_engine
-- Templates d'email et campagnes par tenant. Envoi via Resend (EmailEngineService).

-- ── EMAIL_TEMPLATES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,               -- clé applicative ex: 'welcome', 'payment_receipt'
  subject      TEXT NOT NULL,
  html_content TEXT NOT NULL DEFAULT '',
  text_content TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_admin"
  ON email_templates FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_forum_updated_at();  -- réutilise la fonction générique

-- ── EMAIL_CAMPAIGNS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  template_key     TEXT NOT NULL,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','failed')),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant ON email_campaigns(tenant_id, created_at DESC);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_campaigns_admin"
  ON email_campaigns FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

COMMENT ON TABLE email_templates IS 'Templates HTML/text réutilisables pour les emails transactionnels et campagnes.';
COMMENT ON TABLE email_campaigns IS 'Campagnes email envoyées via Resend, avec suivi recipient_count.';
