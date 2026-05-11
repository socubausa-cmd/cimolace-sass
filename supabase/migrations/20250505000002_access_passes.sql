CREATE TABLE IF NOT EXISTS access_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  payment_id TEXT,
  status TEXT DEFAULT 'active',
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_passes_user ON access_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_access_passes_resource ON access_passes(resource_type, resource_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_passes_unique_tenant_user_resource
  ON access_passes(tenant_id, user_id, resource_type, resource_id);

ALTER TABLE access_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access pass visible par propriétaire" ON access_passes;
CREATE POLICY "Access pass visible par propriétaire" ON access_passes
  FOR SELECT USING (user_id = auth.uid());
