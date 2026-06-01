CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT,
  plan                    TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
  status                  TEXT NOT NULL DEFAULT 'trialing'
                            CHECK (status IN ('trialing','active','past_due','cancelled','incomplete','incomplete_expired','unpaid')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(status, tenant_id) WHERE status IN ('active', 'trialing', 'past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_service_role" ON subscriptions;
CREATE POLICY "subscriptions_service_role" ON subscriptions
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS invoices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id           UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id         TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id  TEXT,
  stripe_charge_id          TEXT,
  amount_cents              INTEGER NOT NULL CHECK (amount_cents >= 0),
  amount_paid_cents         INTEGER NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'EUR',
  status                    TEXT NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')),
  period_start              TIMESTAMPTZ,
  period_end                TIMESTAMPTZ,
  invoice_url               TEXT,
  invoice_pdf               TEXT,
  paid_at                   TIMESTAMPTZ,
  due_date                  TIMESTAMPTZ,
  next_payment_attempt      TIMESTAMPTZ,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_tenant ON invoices(status, tenant_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_service_role" ON invoices;
CREATE POLICY "invoices_service_role" ON invoices
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS billing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  stripe_event_id   TEXT UNIQUE NOT NULL,
  event_type        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error             TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_id ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_event_id ON billing_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_unprocessed ON billing_events(created_at) WHERE processed = FALSE;

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_events_service_role" ON billing_events;
CREATE POLICY "billing_events_service_role" ON billing_events
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW billing_status_view AS
SELECT
  t.id                        AS tenant_id,
  t.name                      AS tenant_name,
  t.plan,
  t.billing_status,
  s.id                        AS subscription_id,
  s.stripe_subscription_id,
  s.status                    AS subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end,
  (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = t.id AND i.status = 'paid') AS paid_invoices_count
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing', 'past_due');
