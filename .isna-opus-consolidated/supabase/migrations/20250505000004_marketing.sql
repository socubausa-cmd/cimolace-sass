CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('exit_intent', 'scroll', 'time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_popups_tenant ON popups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_banners_tenant ON banners(tenant_id);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promo code visible par membres tenant" ON promo_codes;
CREATE POLICY "Promo code visible par membres tenant" ON promo_codes
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = promo_codes.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Promo code modifiable par staff tenant" ON promo_codes;
CREATE POLICY "Promo code modifiable par staff tenant" ON promo_codes
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = promo_codes.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );

DROP POLICY IF EXISTS "Popup visible par membres tenant" ON popups;
CREATE POLICY "Popup visible par membres tenant" ON popups
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = popups.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Popup modifiable par staff tenant" ON popups;
CREATE POLICY "Popup modifiable par staff tenant" ON popups
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = popups.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );

DROP POLICY IF EXISTS "Banner visible par membres tenant" ON banners;
CREATE POLICY "Banner visible par membres tenant" ON banners
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = banners.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Banner modifiable par staff tenant" ON banners;
CREATE POLICY "Banner modifiable par staff tenant" ON banners
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = banners.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );
