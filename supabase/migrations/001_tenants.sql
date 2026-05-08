-- MedOS Foundation: Tenants + Memberships
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'sprout',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'practitioner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON tenants TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON tenant_memberships TO service_role USING (true) WITH CHECK (true);
