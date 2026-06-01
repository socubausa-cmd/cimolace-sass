-- ============================================================================
-- Migration: Tables paiement — payment_providers, payment_transactions
-- Date: 2026-05-21
--
-- Objectif:
-- Normaliser les providers de paiement configurés par tenant (Stripe, PayPal,
-- CinetPay, PawaPay, NowPayments, Chariow) et centraliser toutes les
-- transactions dans une table unifiée avec statut, montant et metadata.
-- ============================================================================

-- ── payment_providers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_providers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL
                              CHECK (provider IN (
                                'stripe', 'paypal', 'cinetpay', 'pawapay',
                                'nowpayments', 'chariow', 'manual'
                              )),
  display_name    TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  config          JSONB       NOT NULL DEFAULT '{}',  -- clés chiffrées côté service
  webhook_url     TEXT,
  supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD'],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant
  ON payment_providers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payment_providers_active
  ON payment_providers(tenant_id, is_active)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS payment_providers_updated_at ON payment_providers;
CREATE TRIGGER payment_providers_updated_at
  BEFORE UPDATE ON payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── payment_transactions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Référence objet source (abonnement, commande, facture…)
  object_type       TEXT,                       -- 'subscription', 'order', 'invoice', etc.
  object_id         UUID,

  provider          TEXT        NOT NULL
                                CHECK (provider IN (
                                  'stripe', 'paypal', 'cinetpay', 'pawapay',
                                  'nowpayments', 'chariow', 'manual'
                                )),
  provider_tx_id    TEXT,                       -- ID de la transaction côté provider
  provider_status   TEXT,                       -- statut brut retourné par le provider

  amount            NUMERIC(12,2) NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'USD',
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending', 'processing', 'succeeded',
                                  'failed', 'refunded', 'cancelled', 'disputed'
                                )),
  type              TEXT        NOT NULL DEFAULT 'charge'
                                CHECK (type IN ('charge', 'refund', 'payout', 'adjustment')),

  description       TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  error_message     TEXT,

  paid_at           TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant
  ON payment_transactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payment_tx_user
  ON payment_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_tx_status
  ON payment_transactions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_tx_object
  ON payment_transactions(object_type, object_id)
  WHERE object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_id
  ON payment_transactions(provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

DROP TRIGGER IF EXISTS payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS : payment_providers ───────────────────────────────────────────────

ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_admin_manage_providers" ON payment_providers;
CREATE POLICY "tenant_admin_manage_providers"
  ON payment_providers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = payment_providers.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = payment_providers.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "service_role_providers" ON payment_providers;
CREATE POLICY "service_role_providers"
  ON payment_providers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── RLS : payment_transactions ────────────────────────────────────────────

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Un user voit ses propres transactions
DROP POLICY IF EXISTS "user_read_own_transactions" ON payment_transactions;
CREATE POLICY "user_read_own_transactions"
  ON payment_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Les admins du tenant voient toutes les transactions
DROP POLICY IF EXISTS "tenant_admin_read_transactions" ON payment_transactions;
CREATE POLICY "tenant_admin_read_transactions"
  ON payment_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = payment_transactions.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "service_role_transactions" ON payment_transactions;
CREATE POLICY "service_role_transactions"
  ON payment_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE payment_providers IS
  'Configuration des providers de paiement actifs par tenant (Stripe, PayPal, CinetPay, PawaPay…).';

COMMENT ON TABLE payment_transactions IS
  'Journal centralisé de toutes les transactions financières, tous providers confondus.';
