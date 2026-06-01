CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'free',
  billing_status TEXT DEFAULT 'unpaid',
  primary_domain TEXT,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON tenant_memberships(user_id);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant visible par membres" ON tenants;
CREATE POLICY "Tenant visible par membres" ON tenants
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant modifiable par owner/admin" ON tenants;
CREATE POLICY "Tenant modifiable par owner/admin" ON tenants
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "Membership visible par soi-même" ON tenant_memberships;
CREATE POLICY "Membership visible par soi-même" ON tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
