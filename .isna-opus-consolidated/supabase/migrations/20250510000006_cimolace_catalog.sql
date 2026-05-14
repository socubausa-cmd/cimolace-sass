-- Cimolace Catalog Foundation
-- Adds tenant_services table and infrastructure_type on tenants

-- 1. Infrastructure type on tenants (a tenant has exactly one infrastructure)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS infrastructure_type TEXT;

COMMENT ON COLUMN tenants.infrastructure_type
  IS 'Infrastructure active du tenant : school, medos, mbolo, wellness, creator, temple, community';

-- CHECK constraint on infrastructure_type
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_infrastructure_type_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_infrastructure_type_check
  CHECK (
    infrastructure_type IS NULL OR
    infrastructure_type IN ('school','medos','mbolo','wellness','creator','temple','community')
  );

-- 2. Tenant services (activated engines per tenant)
CREATE TABLE IF NOT EXISTS tenant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_services_tenant ON tenant_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_services_key ON tenant_services(service_key);
CREATE INDEX IF NOT EXISTS idx_tenant_services_active ON tenant_services(tenant_id, active);

-- RLS
ALTER TABLE tenant_services ENABLE ROW LEVEL SECURITY;

-- Members can read services of their tenant
DROP POLICY IF EXISTS "Tenant services visible par membres" ON tenant_services;
CREATE POLICY "Tenant services visible par membres" ON tenant_services
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Owner/admin can manage services
DROP POLICY IF EXISTS "Tenant services modifiable par owner/admin" ON tenant_services;
CREATE POLICY "Tenant services modifiable par owner/admin" ON tenant_services
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS tenant_services_updated_at ON tenant_services;
CREATE TRIGGER tenant_services_updated_at
  BEFORE UPDATE ON tenant_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
