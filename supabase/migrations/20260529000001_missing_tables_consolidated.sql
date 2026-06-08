-- ═════════════════════════════════════════════════════════════════════════════
-- Migration consolidée — Crée les 9 tables manquantes pour les ports v1→v2
-- (billing avancé, team invites, public reviews, privileged links)
--
-- Cette migration crée les tables avec un schéma simplifié mais fonctionnel,
-- compatible avec les services NestJS v2 qui s'attendent à ces tables.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1) billing_plans (catalogue de plans) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  billing_cycle   TEXT NOT NULL DEFAULT 'monthly',
  features        JSONB DEFAULT '{}',
  stripe_price_id TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2) billing_payments (paiements individuels) ───────────────────────────
CREATE TABLE IF NOT EXISTS billing_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID,
  provider        TEXT NOT NULL,
  provider_payment_id TEXT,
  amount_cents    INT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_tenant ON billing_payments(tenant_id, created_at DESC);

-- ─── 3) billing_renewal_links ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_renewal_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID,
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  used_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4) billing_webhook_logs (audit des webhooks reçus) ────────────────────
CREATE TABLE IF NOT EXISTS billing_webhook_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL,
  event_type      TEXT,
  provider_event_id TEXT,
  payload         JSONB,
  signature_valid BOOLEAN,
  processed       BOOLEAN NOT NULL DEFAULT false,
  error           TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_provider ON billing_webhook_logs(provider, received_at DESC);

-- ─── 5) tenant_payment_accounts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_payment_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  account_id      TEXT,
  capabilities    JSONB DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- ─── 6) team_invitations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_by      UUID,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'teacher',
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at     TIMESTAMPTZ,
  accepted_by     UUID,
  status          TEXT NOT NULL DEFAULT 'pending',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON team_invitations(tenant_id);

-- ─── 7) access_audit_log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  ip              INET,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_tenant ON access_audit_log(tenant_id, created_at DESC);

-- ─── 8) privileged_link_redemptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS privileged_link_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privileged_link_id UUID,
  redeemed_by     UUID,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip              INET,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}'
);

-- ─── 9) privileged_access_grants ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS privileged_access_grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID,
  granted_by      UUID,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  permission      TEXT NOT NULL DEFAULT 'read',
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_grants_user ON privileged_access_grants(user_id, resource_type);

-- ─── 10) notification_queue (bonus — manquante en v1 aussi) ────────────────
CREATE TABLE IF NOT EXISTS notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID,
  channel         TEXT NOT NULL,
  template        TEXT,
  payload         JSONB DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  error           TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue(scheduled_at)
  WHERE status = 'pending';

-- ═══ RLS — service_role full access pour toutes ═══
DO $$ BEGIN
  ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
  ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE billing_renewal_links ENABLE ROW LEVEL SECURITY;
  ALTER TABLE billing_webhook_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant_payment_accounts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;
  ALTER TABLE privileged_link_redemptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE privileged_access_grants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY srv_billing_plans ON billing_plans TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_billing_payments ON billing_payments TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_billing_renewal_links ON billing_renewal_links TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_billing_webhook_logs ON billing_webhook_logs TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_tenant_payment_accounts ON tenant_payment_accounts TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_team_invitations ON team_invitations TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_access_audit_log ON access_audit_log TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_priv_link_redemptions ON privileged_link_redemptions TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_priv_access_grants ON privileged_access_grants TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY srv_notification_queue ON notification_queue TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══ Seed billing_plans (compatible avec STRIPE_PLAN_*_PRICE_ID dans .env) ═══
INSERT INTO billing_plans (key, label, description, price_cents, currency, billing_cycle, features, is_active) VALUES
  ('starter',  'Starter',  'Plan d''entrée pour petites écoles',     1900,  'EUR', 'monthly',
   '{"max_students":50,"max_courses":10,"max_lives_per_month":4,"max_storage_gb":5,"liri_credits":2000}', true),
  ('pro',      'Pro',      'Plan recommandé pour la plupart des écoles', 4900,  'EUR', 'monthly',
   '{"max_students":500,"max_courses":100,"max_lives_per_month":-1,"max_storage_gb":50,"liri_credits":10000}', true),
  ('business', 'Business', 'Plan complet avec white-label',           14900, 'EUR', 'monthly',
   '{"max_students":2000,"max_courses":-1,"max_lives_per_month":-1,"max_storage_gb":500,"white_label":true,"liri_credits":50000}', true)
ON CONFLICT (key) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  features = EXCLUDED.features;
