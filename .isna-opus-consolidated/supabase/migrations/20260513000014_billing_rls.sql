-- RLS policies for billing tables (owner/admin access)
-- Opus 20250505000005_billing.sql uses service_role only.
-- This migration adds tenant-scoped RLS for owner/admin members.
-- Source: adapted from isna-flash/supabase/migrations/20250505_007_billing_saas.sql
-- Applied: 2026-05-13 — consolidation isna-opus

-- Subscriptions: visible by owner/admin of the tenant
DROP POLICY IF EXISTS "Subscription visible par owner/admin tenant" ON subscriptions;
CREATE POLICY "Subscription visible par owner/admin tenant" ON subscriptions
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Subscriptions: modifiable by owner only
DROP POLICY IF EXISTS "Subscription modifiable par owner tenant" ON subscriptions;
CREATE POLICY "Subscription modifiable par owner tenant" ON subscriptions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Invoices: visible by owner/admin
DROP POLICY IF EXISTS "Invoice visible par owner/admin tenant" ON invoices;
CREATE POLICY "Invoice visible par owner/admin tenant" ON invoices
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = invoices.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Billing events: visible by owner/admin
DROP POLICY IF EXISTS "Billing events visible par owner/admin tenant" ON billing_events;
CREATE POLICY "Billing events visible par owner/admin tenant" ON billing_events
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = billing_events.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );
