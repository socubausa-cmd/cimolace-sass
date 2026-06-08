-- Migration: privileged_links table
-- Stores unique codes granting privileged access to resources (courses, content)
-- with optional expiry and limited use counts.
-- Applied: 2026-05-28

CREATE TABLE IF NOT EXISTS privileged_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  resource_type TEXT NOT NULL DEFAULT 'course',
  resource_id TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  max_uses INT NOT NULL DEFAULT 1,
  use_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privileged_links_code ON privileged_links(code);
CREATE INDEX IF NOT EXISTS idx_privileged_links_tenant ON privileged_links(tenant_id);

ALTER TABLE privileged_links ENABLE ROW LEVEL SECURITY;

-- Tenant members can see active, non-expired links for their tenant
CREATE POLICY members_read_active ON privileged_links
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Tenant admins/owners can manage all links for their tenant
CREATE POLICY admins_manage ON privileged_links
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','owner') AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','owner') AND status = 'active'
    )
  );
