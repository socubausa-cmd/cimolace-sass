-- Rattache prorascience.org au tenant isna pour :
--   • la résolution host → tenant côté API (getTenantByHost lit tenant_domains usage='custom_host')
--   • l'autorisation CORS dynamique (main.ts loadTenantDomains lit usage IN custom_host/embed_origin)
-- Le routage front (App.jsx) mappe déjà prorascience.org → /t/isna ; il manquait ces lignes DB.
--
-- ⚠️ `supabase db push` est cassé → appliquer à la main dans le SQL Editor Supabase.

DO $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'isna' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant isna introuvable — appliquer d''abord 20260527000002_seed_isna_tenant.sql';
  END IF;

  INSERT INTO tenant_domains (tenant_id, domain, usage, status) VALUES
    (v_tenant_id, 'prorascience.org',      'custom_host',  'active'),
    (v_tenant_id, 'www.prorascience.org',  'custom_host',  'active'),
    (v_tenant_id, 'isna.prorascience.org', 'custom_host',  'active'),
    (v_tenant_id, 'prorascience.org',      'embed_origin', 'active'),
    (v_tenant_id, 'www.prorascience.org',  'embed_origin', 'active')
  ON CONFLICT (domain, usage) DO UPDATE
    SET status = 'active', updated_at = now();
END $$;
