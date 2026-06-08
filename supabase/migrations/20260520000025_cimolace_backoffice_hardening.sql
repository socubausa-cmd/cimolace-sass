-- ============================================================================
-- Migration: Durcissement back-office Cimolace + socle ISNA
-- Date: 2026-05-20
--
-- Objectif:
-- - remplacer la lecture "tout utilisateur authentifié" par un vrai staff Cimolace;
-- - créer les tables opérationnelles attendues par les moteurs Cimolace;
-- - aligner ISNA/PRORASCIENCE sur un plan platform avec contrat/abonnement minimal.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Staff Cimolace ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cimolace_staff_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('owner', 'admin', 'support')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cimolace_staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cimolace_staff_read_self" ON cimolace_staff_members;
CREATE POLICY "cimolace_staff_read_self" ON cimolace_staff_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_cimolace_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cimolace_staff_members staff
    WHERE staff.user_id = auth.uid()
      AND staff.status = 'active'
      AND staff.role IN ('owner', 'admin', 'support')
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND profile.status = 'active'
      AND profile.metadata->>'cimolace_staff' = 'true'
  );
$$;

-- ── Colonnes manquantes / cohérence tenant technique ───────────────────────

ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cimolace_tenants_slug
  ON cimolace_tenants(lower(slug))
  WHERE slug IS NOT NULL;

UPDATE cimolace_tenants
SET slug = lower(COALESCE(metadata->>'app_tenant_slug', regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
    updated_at = now()
WHERE slug IS NULL;

-- ── Tables opérationnelles attendues par les moteurs frontend ──────────────

CREATE TABLE IF NOT EXISTS cimolace_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}',
  quota_limit NUMERIC,
  quota_used NUMERIC NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, service_key)
);

CREATE TABLE IF NOT EXISTS cimolace_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'count',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'api_key',
  description TEXT,
  last_rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_configuration_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, step_number)
);

CREATE TABLE IF NOT EXISTS cimolace_billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  client_id UUID REFERENCES cimolace_clients(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'platform',
  billing_mode TEXT NOT NULL DEFAULT 'manual',
  currency TEXT NOT NULL DEFAULT 'XOF',
  amount NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES cimolace_subscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'subscription',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_payment_id TEXT,
  provider_invoice_url TEXT,
  invoice_number TEXT,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE SET NULL,
  billing_profile_id UUID REFERENCES cimolace_billing_profiles(id) ON DELETE SET NULL,
  invoice_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  type TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  contact_email TEXT,
  assignee TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES cimolace_tickets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'support',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES cimolace_tenants(id) ON DELETE SET NULL,
  changed_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cimolace_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  environment TEXT NOT NULL DEFAULT 'production',
  version TEXT,
  deployed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tables billing API multi-provider si la migration historique n'a pas été poussée.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  provider_checkout_id TEXT,
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  provider_transaction_id TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_phone_country TEXT,
  canceled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  provider_invoice_id TEXT,
  provider_transaction_id TEXT,
  invoice_number TEXT,
  description TEXT,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Index de base ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cimolace_services_site ON cimolace_services(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_usage_site ON cimolace_usage_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_credentials_site ON cimolace_credentials(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_config_site ON cimolace_configuration_steps(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_payments_site ON cimolace_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_invoices_site ON cimolace_invoices(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_tickets_site ON cimolace_tickets(site_id);
CREATE INDEX IF NOT EXISTS idx_billing_subs_tenant ON billing_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON billing_invoices(tenant_id);

-- ── RLS back-office: seul le staff Cimolace lit/écrit côté client direct. ───

ALTER TABLE cimolace_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_configuration_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cimolace_tenants_read_authenticated" ON cimolace_tenants;
DROP POLICY IF EXISTS "cimolace_clients_read_authenticated" ON cimolace_clients;
DROP POLICY IF EXISTS "cimolace_sites_read_authenticated" ON cimolace_sites;
DROP POLICY IF EXISTS "cimolace_contracts_read_authenticated" ON cimolace_contracts;
DROP POLICY IF EXISTS "cimolace_subscriptions_read_authenticated" ON cimolace_subscriptions;

DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_tenants;
CREATE POLICY "cimolace_staff_all" ON cimolace_tenants FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_clients;
CREATE POLICY "cimolace_staff_all" ON cimolace_clients FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_sites;
CREATE POLICY "cimolace_staff_all" ON cimolace_sites FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_contracts;
CREATE POLICY "cimolace_staff_all" ON cimolace_contracts FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_subscriptions;
CREATE POLICY "cimolace_staff_all" ON cimolace_subscriptions FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_services;
CREATE POLICY "cimolace_staff_all" ON cimolace_services FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_usage_logs;
CREATE POLICY "cimolace_staff_all" ON cimolace_usage_logs FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_credentials;
CREATE POLICY "cimolace_staff_all" ON cimolace_credentials FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_configuration_steps;
CREATE POLICY "cimolace_staff_all" ON cimolace_configuration_steps FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_billing_profiles;
CREATE POLICY "cimolace_staff_all" ON cimolace_billing_profiles FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_payments;
CREATE POLICY "cimolace_staff_all" ON cimolace_payments FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_invoices;
CREATE POLICY "cimolace_staff_all" ON cimolace_invoices FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_tickets;
CREATE POLICY "cimolace_staff_all" ON cimolace_tickets FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_ticket_messages;
CREATE POLICY "cimolace_staff_all" ON cimolace_ticket_messages FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_change_history;
CREATE POLICY "cimolace_staff_all" ON cimolace_change_history FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());
DROP POLICY IF EXISTS "cimolace_staff_all" ON cimolace_deployments;
CREATE POLICY "cimolace_staff_all" ON cimolace_deployments FOR ALL TO authenticated USING (public.is_cimolace_staff()) WITH CHECK (public.is_cimolace_staff());

-- ── Alignement ISNA / PRORASCIENCE ─────────────────────────────────────────

INSERT INTO profiles (id, email, name, role, status, metadata)
SELECT
  t.owner_user_id,
  lower(au.email),
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'Owner ISNA'),
  'owner',
  'active',
  jsonb_build_object('source', 'cimolace_backoffice_hardening', 'tenant_slug', t.slug)
FROM tenants t
LEFT JOIN auth.users au ON au.id = t.owner_user_id
WHERE t.slug = 'isna'
  AND t.owner_user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE
  SET role = CASE WHEN profiles.role IN ('visitor', 'student') THEN 'owner' ELSE profiles.role END,
      status = 'active',
      email = COALESCE(profiles.email, EXCLUDED.email),
      metadata = profiles.metadata || EXCLUDED.metadata,
      updated_at = now();

WITH isna AS (
  SELECT c.id AS client_id, c.tenant_id AS app_tenant_id, c.plan
  FROM cimolace_clients c
  WHERE c.portal_slug = 'isna'
  LIMIT 1
),
site AS (
  UPDATE cimolace_sites s
  SET plan = COALESCE((SELECT plan FROM isna), 'platform'),
      status = 'active',
      updated_at = now()
  WHERE s.client_id = (SELECT client_id FROM isna)
  RETURNING s.id, s.client_id, s.app_tenant_id, s.plan
),
contract AS (
  INSERT INTO cimolace_contracts (client_id, site_id, contract_type, setup_amount, monthly_amount, min_duration_months, start_date, status, special_conditions, metadata)
  SELECT
    site.client_id,
    site.id,
    'platform_subscription',
    0,
    0,
    12,
    CURRENT_DATE,
    'active',
    'Contrat technique de reprise ISNA / PRORASCIENCE dans Cimolace.',
    jsonb_build_object('source', 'cimolace_backoffice_hardening', 'contract_key', 'isna-platform-2026')
  FROM site
  WHERE NOT EXISTS (
    SELECT 1 FROM cimolace_contracts existing
    WHERE existing.client_id = site.client_id
      AND existing.contract_type = 'platform_subscription'
      AND existing.metadata->>'contract_key' = 'isna-platform-2026'
  )
  RETURNING id
)
INSERT INTO cimolace_subscriptions (site_id, client_id, status, plan, amount, currency, current_period_start, current_period_end, metadata)
SELECT
  site.id,
  site.client_id,
  'active',
  site.plan,
  0,
  'XOF',
  now(),
  now() + INTERVAL '1 year',
  jsonb_build_object('source', 'cimolace_backoffice_hardening', 'subscription_key', 'isna-platform-2026')
FROM site
WHERE NOT EXISTS (
  SELECT 1 FROM cimolace_subscriptions existing
  WHERE existing.client_id = site.client_id
    AND existing.site_id = site.id
    AND existing.metadata->>'subscription_key' = 'isna-platform-2026'
);

WITH isna AS (
  SELECT t.id AS tenant_id, t.owner_user_id, c.id AS client_id, s.id AS site_id
  FROM tenants t
  JOIN cimolace_clients c ON c.tenant_id = t.id
  LEFT JOIN cimolace_sites s ON s.client_id = c.id
  WHERE t.slug = 'isna'
  LIMIT 1
),
sub AS (
  INSERT INTO billing_subscriptions (tenant_id, user_id, plan_id, provider, status, amount_cents, currency, current_period_start, current_period_end, metadata)
  SELECT
    tenant_id,
    owner_user_id,
    'platform',
    'chariow',
    'active',
    0,
    'XOF',
    now(),
    now() + INTERVAL '1 year',
    jsonb_build_object('source', 'cimolace_backoffice_hardening', 'subscription_key', 'isna-platform-2026')
  FROM isna
  WHERE owner_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM billing_subscriptions existing
      WHERE existing.tenant_id = isna.tenant_id
        AND existing.metadata->>'subscription_key' = 'isna-platform-2026'
    )
  RETURNING id, tenant_id
)
INSERT INTO billing_invoices (tenant_id, subscription_id, provider, status, amount_cents, currency, invoice_number, description, paid_at, metadata)
SELECT
  tenant_id,
  id,
  'chariow',
  'paid',
  0,
  'XOF',
  'ISNA-PLATFORM-2026-INIT',
  'Initialisation facturation ISNA / PRORASCIENCE dans Cimolace',
  now(),
  jsonb_build_object('source', 'cimolace_backoffice_hardening')
FROM sub;

WITH isna_site AS (
  SELECT s.id AS site_id
  FROM cimolace_clients c
  JOIN cimolace_sites s ON s.client_id = c.id
  WHERE c.portal_slug = 'isna'
  LIMIT 1
)
INSERT INTO cimolace_services (site_id, service_key, status, config, activated_at)
SELECT
  isna_site.site_id,
  service_key,
  'active',
  jsonb_build_object('source', 'tenant_services_sync'),
  now()
FROM isna_site
CROSS JOIN (
  VALUES
    ('liri_smartboard'),
    ('liri_live'),
    ('liri_replay'),
    ('marketing_creator'),
    ('calendar'),
    ('course_builder')
) AS services(service_key)
ON CONFLICT (site_id, service_key) DO UPDATE
  SET status = 'active',
      config = cimolace_services.config || EXCLUDED.config,
      activated_at = COALESCE(cimolace_services.activated_at, EXCLUDED.activated_at),
      updated_at = now();
