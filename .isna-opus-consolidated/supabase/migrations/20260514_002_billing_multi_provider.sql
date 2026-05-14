-- ============================================================================
-- Migration: Billing — Subscriptions, Invoices, Events, Payment Accounts
-- Date: 2026-05-14
-- Bloc 2 — Billing SaaS Multi-Provider
-- ============================================================================

-- ── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'stripe'
                  CHECK (provider IN ('stripe','chariow','cinetpay','nowpayments','paypal')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','past_due','canceled','expired','paused')),
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'XOF',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  provider_checkout_id       TEXT,
  provider_subscription_id   TEXT,
  provider_customer_id       TEXT,
  provider_transaction_id    TEXT,
  customer_email   TEXT,
  customer_phone   TEXT,
  customer_phone_country TEXT,
  canceled_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_subs_tenant ON billing_subscriptions(tenant_id);
CREATE INDEX idx_billing_subs_status ON billing_subscriptions(status);
CREATE INDEX idx_billing_subs_provider_checkout ON billing_subscriptions(provider, provider_checkout_id);

-- ── Invoices ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL DEFAULT 'stripe',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','failed','refunded','canceled')),
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'XOF',
  provider_invoice_id    TEXT,
  provider_transaction_id TEXT,
  invoice_number  TEXT,
  description     TEXT,
  paid_at         TIMESTAMPTZ,
  due_date        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_invoices_tenant ON billing_invoices(tenant_id);
CREATE INDEX idx_billing_invoices_sub ON billing_invoices(subscription_id);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status);

-- ── Billing Events (idempotence + webhook audit) ────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL,
  provider        TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'webhook',
  payload         JSONB DEFAULT '{}',
  processed       BOOLEAN NOT NULL DEFAULT false,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  retry_count     INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_event_id, provider)
);

CREATE INDEX idx_billing_events_processed ON billing_events(processed);
CREATE INDEX idx_billing_events_provider ON billing_events(provider);

-- ── Tenant Payment Accounts (per-tenant provider configuration) ─────────────

CREATE TABLE IF NOT EXISTS tenant_payment_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  providers       JSONB DEFAULT '{}',
  preferences     JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_payment_accounts_tenant ON tenant_payment_accounts(tenant_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Subscriptions: staff full access, students read own
CREATE POLICY "staff_access_subs" ON billing_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = billing_subscriptions.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin')
    )
  );

-- Invoices: staff full access, students read own
CREATE POLICY "staff_access_invoices" ON billing_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = billing_invoices.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin')
    )
  );

-- Payment accounts: owner only
CREATE POLICY "owner_access_payment_accounts" ON tenant_payment_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = tenant_payment_accounts.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- Events: service_role only (internal)
CREATE POLICY "service_role_events" ON billing_events
  FOR ALL USING (true);  -- Rely on API-level auth for events

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_billing_subs_updated_at
  BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trg_billing_invoices_updated_at
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();
