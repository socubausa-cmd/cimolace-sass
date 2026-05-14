-- ============================================================
-- Phase 5 — Billing V2
-- · Colonnes Stripe manquantes sur tenants
-- · Index billing_events pour idempotence webhook
-- ============================================================

-- ── Colonnes Stripe sur tenants ───────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_subscription_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_sub
  ON tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── billing_events : index idempotence (already UNIQUE on stripe_event_id) ───
-- Vérifie que l'index unique existe (créé dans 20250505000005_billing.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_events'
      AND indexname  = 'billing_events_stripe_event_id_key'
  ) THEN
    ALTER TABLE billing_events
      ADD CONSTRAINT billing_events_stripe_event_id_key
      UNIQUE (stripe_event_id);
  END IF;
END $$;
