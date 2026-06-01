-- ============================================================================
-- Migration: Cohérence Cimolace SaaS <-> tenants applicatifs
-- Date: 2026-05-20
--
-- Objectif:
-- - garder public.tenants comme registre applicatif multi-tenant;
-- - fournir les tables CRM/backoffice Cimolace attendues par le code;
-- - créer une table profiles compatible avec l'auth/frontend historique;
-- - exposer le tenant ISNA dans le backoffice Cimolace.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Profils frontend/auth historiques ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'visitor',
  status TEXT NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  phone TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  student_profile_completed BOOLEAN NOT NULL DEFAULT false,
  student_profile_completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'visitor';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_profile_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_profile_completed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(lower(email));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_authenticated" ON profiles;
CREATE POLICY "profiles_read_authenticated" ON profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Registre technique Cimolace ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cimolace_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cimolace_tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_cimolace_tenants_email ON cimolace_tenants(lower(email));
CREATE INDEX IF NOT EXISTS idx_cimolace_tenants_status ON cimolace_tenants(status);

CREATE TABLE IF NOT EXISTS cimolace_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  business_name TEXT,
  client_type TEXT NOT NULL DEFAULT 'other',
  contact_person TEXT,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  plan TEXT NOT NULL DEFAULT 'starter',
  portal_slug TEXT,
  source TEXT,
  commercial_responsible TEXT,
  internal_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'prospect';
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS portal_slug TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS commercial_responsible TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cimolace_clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_cimolace_clients_portal_slug
  ON cimolace_clients(lower(portal_slug))
  WHERE portal_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cimolace_clients_tenant ON cimolace_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_clients_status ON cimolace_clients(status);

CREATE TABLE IF NOT EXISTS cimolace_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES cimolace_tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES cimolace_clients(id) ON DELETE SET NULL,
  app_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  domain TEXT,
  subdomain TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'pending',
  environment TEXT NOT NULL DEFAULT 'production',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES cimolace_tenants(id) ON DELETE CASCADE;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES cimolace_clients(id) ON DELETE SET NULL;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS app_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS subdomain TEXT;
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production';
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cimolace_sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_cimolace_sites_tenant ON cimolace_sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_sites_client ON cimolace_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_sites_app_tenant ON cimolace_sites(app_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_sites_status ON cimolace_sites(status);

CREATE TABLE IF NOT EXISTS cimolace_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES cimolace_clients(id) ON DELETE CASCADE,
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL DEFAULT 'subscription',
  setup_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  min_duration_months INTEGER,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  special_conditions TEXT,
  contract_pdf_url TEXT,
  signature_date TIMESTAMPTZ,
  internal_responsible TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cimolace_contracts_client ON cimolace_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_contracts_site ON cimolace_contracts(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_contracts_status ON cimolace_contracts(status);

CREATE TABLE IF NOT EXISTS cimolace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES cimolace_sites(id) ON DELETE CASCADE,
  client_id UUID REFERENCES cimolace_clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'starter',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cimolace_subscriptions_site ON cimolace_subscriptions(site_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_subscriptions_client ON cimolace_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_cimolace_subscriptions_status ON cimolace_subscriptions(status);

-- ── Vues attendues par certains moteurs frontend ───────────────────────────

CREATE OR REPLACE VIEW cimolace_clients_overview AS
SELECT
  c.*,
  COUNT(DISTINCT s.id) AS sites_count,
  COUNT(DISTINCT ct.id) AS contracts_count
FROM cimolace_clients c
LEFT JOIN cimolace_sites s ON s.client_id = c.id
LEFT JOIN cimolace_contracts ct ON ct.client_id = c.id
GROUP BY c.id;

CREATE OR REPLACE VIEW cimolace_sites_overview AS
SELECT
  s.*,
  c.name AS client_name,
  c.email AS client_email,
  t.name AS technical_tenant_name,
  t.email AS technical_tenant_email
FROM cimolace_sites s
LEFT JOIN cimolace_clients c ON c.id = s.client_id
LEFT JOIN cimolace_tenants t ON t.id = s.tenant_id;

-- ── Seed de cohérence: ISNA visible dans le backoffice Cimolace ─────────────

WITH app_tenant AS (
  SELECT id, name, slug, plan, status
  FROM tenants
  WHERE slug = 'isna'
  LIMIT 1
),
technical_tenant AS (
  INSERT INTO cimolace_tenants (name, email, status, metadata)
  SELECT
    'ISNA',
    'contact@isna.pro',
    'active',
    jsonb_build_object('source', 'consistency_migration', 'app_tenant_slug', slug)
  FROM app_tenant
  ON CONFLICT (lower(email)) DO UPDATE
    SET name = EXCLUDED.name,
        status = EXCLUDED.status,
        metadata = cimolace_tenants.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING id
),
client AS (
  INSERT INTO cimolace_clients (
    tenant_id,
    name,
    business_name,
    client_type,
    email,
    status,
    plan,
    portal_slug,
    source,
    metadata
  )
  SELECT
    id,
    'ISNA',
    'ISNA / PRORASCIENCE',
    'school',
    'contact@isna.pro',
    'active',
    COALESCE(plan, 'platform'),
    'isna',
    'consistency_migration',
    jsonb_build_object('app_tenant_id', id, 'app_tenant_slug', slug)
  FROM app_tenant
  ON CONFLICT (lower(portal_slug)) WHERE portal_slug IS NOT NULL DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        name = EXCLUDED.name,
        business_name = EXCLUDED.business_name,
        client_type = EXCLUDED.client_type,
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        metadata = cimolace_clients.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING id, tenant_id
)
INSERT INTO cimolace_sites (
  tenant_id,
  client_id,
  app_tenant_id,
  name,
  domain,
  subdomain,
  plan,
  status,
  environment,
  metadata
)
SELECT
  (SELECT id FROM technical_tenant LIMIT 1),
  client.id,
  client.tenant_id,
  'ISNA Academy',
  'prorascience.org',
  'isna',
  'starter',
  'active',
  'production',
  jsonb_build_object('source', 'consistency_migration', 'app_tenant_slug', 'isna')
FROM client
WHERE NOT EXISTS (
  SELECT 1
  FROM cimolace_sites s
  WHERE s.client_id = client.id
    AND s.app_tenant_id = client.tenant_id
);

-- Le tenant ISNA / PRORASCIENCE est une infrastructure école dans Cimolace.
UPDATE tenants
SET infrastructure_type = 'school',
    updated_at = now()
WHERE slug = 'isna';

INSERT INTO tenant_services (tenant_id, service_key, active, settings)
SELECT
  t.id,
  service_key,
  true,
  jsonb_build_object('source', 'cimolace_school_template')
FROM tenants t
CROSS JOIN (
  VALUES
    ('liri_smartboard'),
    ('liri_live'),
    ('liri_replay'),
    ('marketing_creator'),
    ('calendar'),
    ('course_builder')
) AS school_services(service_key)
WHERE t.slug = 'isna'
ON CONFLICT (tenant_id, service_key) DO UPDATE
  SET active = EXCLUDED.active,
      settings = tenant_services.settings || EXCLUDED.settings,
      updated_at = now();

-- ── RLS backoffice: service_role écrit; utilisateurs authentifiés lisent. ───

ALTER TABLE cimolace_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cimolace_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cimolace_tenants_read_authenticated" ON cimolace_tenants;
CREATE POLICY "cimolace_tenants_read_authenticated" ON cimolace_tenants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cimolace_clients_read_authenticated" ON cimolace_clients;
CREATE POLICY "cimolace_clients_read_authenticated" ON cimolace_clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cimolace_sites_read_authenticated" ON cimolace_sites;
CREATE POLICY "cimolace_sites_read_authenticated" ON cimolace_sites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cimolace_contracts_read_authenticated" ON cimolace_contracts;
CREATE POLICY "cimolace_contracts_read_authenticated" ON cimolace_contracts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cimolace_subscriptions_read_authenticated" ON cimolace_subscriptions;
CREATE POLICY "cimolace_subscriptions_read_authenticated" ON cimolace_subscriptions FOR SELECT TO authenticated USING (true);
