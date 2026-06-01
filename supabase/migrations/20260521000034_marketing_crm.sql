-- ============================================================================
-- Migration: Tables Marketing & CRM
-- Date: 2026-05-21
--
-- Tables : leads, funnels, campaigns, automations
--          (marketing_campaigns, marketing_funnels, marketing_automations
--           sont des vues/alias pour compatibilité avec l'ancien code)
-- ============================================================================

-- ── leads ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  email           TEXT          NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  company         TEXT,
  source          TEXT          NOT NULL DEFAULT 'organic'
                                CHECK (source IN ('organic','paid','referral','email','social','direct','import','other')),
  status          TEXT          NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','contacted','qualified','converted','lost','unsubscribed')),
  score           INT           NOT NULL DEFAULT 0,

  funnel_id       UUID,                     -- FK ajoutée après création funnels
  campaign_id     UUID,                     -- FK ajoutée après création campaigns
  converted_at    TIMESTAMPTZ,
  tags            TEXT[]        NOT NULL DEFAULT '{}',
  metadata        JSONB         NOT NULL DEFAULT '{}',
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant  ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_score   ON leads(tenant_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source  ON leads(tenant_id, source);

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── funnels ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funnels (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT          NOT NULL,
  slug            TEXT,
  description     TEXT,
  funnel_type     TEXT          NOT NULL DEFAULT 'lead_gen'
                                CHECK (funnel_type IN ('lead_gen','sales','webinar','product_launch','tripwire','other')),
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','paused','archived')),

  steps           JSONB         NOT NULL DEFAULT '[]',  -- [{step_type, page_url, conversion_rate}]
  goal_url        TEXT,
  conversion_goal TEXT,

  total_visitors  INT           NOT NULL DEFAULT 0,
  total_leads     INT           NOT NULL DEFAULT 0,
  total_converted INT           NOT NULL DEFAULT 0,

  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_funnels_tenant ON funnels(tenant_id, status);

DROP TRIGGER IF EXISTS funnels_updated_at ON funnels;
CREATE TRIGGER funnels_updated_at
  BEFORE UPDATE ON funnels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── campaigns ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT          NOT NULL,
  campaign_type   TEXT          NOT NULL DEFAULT 'email'
                                CHECK (campaign_type IN ('email','sms','push','social','paid','webinar','other')),
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),

  subject         TEXT,
  content         TEXT,
  template_id     TEXT,

  audience        JSONB         NOT NULL DEFAULT '{}',  -- {segment, filters, list_id}
  schedule        JSONB         NOT NULL DEFAULT '{}',  -- {send_at, timezone, recurring}

  -- Stats
  sent_count      INT           NOT NULL DEFAULT 0,
  open_count      INT           NOT NULL DEFAULT 0,
  click_count     INT           NOT NULL DEFAULT 0,
  bounce_count    INT           NOT NULL DEFAULT 0,
  unsubscribe_count INT         NOT NULL DEFAULT 0,
  conversion_count  INT         NOT NULL DEFAULT 0,

  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type   ON campaigns(tenant_id, campaign_type);

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── automations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT          NOT NULL,
  description     TEXT,
  trigger_type    TEXT          NOT NULL DEFAULT 'event'
                                CHECK (trigger_type IN ('event','schedule','webhook','manual')),
  trigger_config  JSONB         NOT NULL DEFAULT '{}',  -- {event_name, cron, conditions}

  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','paused','archived')),

  steps           JSONB         NOT NULL DEFAULT '[]',  -- [{action_type, config, delay_seconds}]
  -- ex: [{action_type: "send_email", config: {template: "..."}, delay_seconds: 0}]

  run_count       INT           NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  error_count     INT           NOT NULL DEFAULT 0,

  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_automations_active ON automations(tenant_id, trigger_type)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS automations_updated_at ON automations;
CREATE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── FK différées (leads → funnels / campaigns) ────────────────────────────

ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS leads_funnel_id_fk
  FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS leads_campaign_id_fk
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- ── Vues aliases (compatibilité avec ancien code marketing_*) ─────────────

CREATE OR REPLACE VIEW public.marketing_campaigns AS SELECT * FROM campaigns;
CREATE OR REPLACE VIEW public.marketing_funnels   AS SELECT * FROM funnels;
CREATE OR REPLACE VIEW public.marketing_automations AS SELECT * FROM automations;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Toutes les tables marketing : admin/owner gèrent, membre lit
DO $$ BEGIN
  -- leads
  DROP POLICY IF EXISTS "admin_manage_leads" ON leads;
  CREATE POLICY "admin_manage_leads" ON leads FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = leads.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = leads.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
  DROP POLICY IF EXISTS "sr_leads" ON leads;
  CREATE POLICY "sr_leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- funnels
  DROP POLICY IF EXISTS "member_read_funnels" ON funnels;
  CREATE POLICY "member_read_funnels" ON funnels FOR SELECT TO authenticated
    USING (status = 'active' AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = funnels.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "admin_manage_funnels" ON funnels;
  CREATE POLICY "admin_manage_funnels" ON funnels FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = funnels.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = funnels.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
  DROP POLICY IF EXISTS "sr_funnels" ON funnels;
  CREATE POLICY "sr_funnels" ON funnels FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- campaigns
  DROP POLICY IF EXISTS "admin_manage_campaigns" ON campaigns;
  CREATE POLICY "admin_manage_campaigns" ON campaigns FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = campaigns.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = campaigns.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
  DROP POLICY IF EXISTS "sr_campaigns" ON campaigns;
  CREATE POLICY "sr_campaigns" ON campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- automations
  DROP POLICY IF EXISTS "admin_manage_automations" ON automations;
  CREATE POLICY "admin_manage_automations" ON automations FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = automations.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = automations.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
  DROP POLICY IF EXISTS "sr_automations" ON automations;
  CREATE POLICY "sr_automations" ON automations FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

COMMENT ON TABLE leads       IS 'Prospects CRM avec scoring, source UTM et pipeline de conversion.';
COMMENT ON TABLE funnels     IS 'Tunnels de vente multi-étapes avec stats de conversion.';
COMMENT ON TABLE campaigns   IS 'Campagnes marketing multi-canal (email, SMS, social, payant).';
COMMENT ON TABLE automations IS 'Séquences automatisées déclenchées par événement, schedule ou webhook.';
