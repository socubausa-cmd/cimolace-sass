-- Stripe Connect + Customer columns on tenants
-- Source: isna-flash/supabase/migrations/20250505_008_stripe_connect.sql
-- Applied: 2026-05-13 — consolidation isna-opus

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_account ON tenants(stripe_account_id);
