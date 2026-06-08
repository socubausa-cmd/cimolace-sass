-- Seed : tenant ISNA / PRORASCIENCE
-- Ce script est idempotent (INSERT ... ON CONFLICT DO NOTHING ou UPDATE).
-- À exécuter via Supabase Dashboard → SQL Editor ou supabase db push.

-- 1. Créer le tenant si absent
INSERT INTO tenants (
  name,
  slug,
  status,
  plan,
  billing_status,
  primary_domain,
  logo_url,
  brand_colors,
  timezone,
  locale,
  metadata
)
VALUES (
  'ISNA – Institut Supérieur de Nutrition Alimentaire',
  'isna',
  'active',
  'pro',
  'active',
  'prorascience.org',
  '/logos/isna-logo.png',
  '{"primary": "#1a5f7a", "secondary": "#2c3e50", "accent": "#e74c3c"}'::jsonb,
  'Europe/Paris',
  'fr',
  '{
    "branding": {
      "name": "PRORASCIENCE",
      "fullName": "Institut Supérieur de Nutrition Alimentaire",
      "shortName": "ISNA",
      "logo": "/logos/isna-logo.png",
      "favicon": "/favicons/isna-favicon.ico",
      "primaryColor": "#1a5f7a",
      "secondaryColor": "#2c3e50",
      "accentColor": "#e74c3c",
      "backgroundColor": "#f8f9fa",
      "domain": "prorascience.org",
      "publicSiteOrigin": "https://prorascience.org",
      "vitrineContactEmail": "infos@prorascience.org"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET
    name           = EXCLUDED.name,
    status         = 'active',
    primary_domain = COALESCE(tenants.primary_domain, EXCLUDED.primary_domain),
    brand_colors   = EXCLUDED.brand_colors,
    metadata       = COALESCE(tenants.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at     = now()
;

-- 2. Activer les modules ISNA (idempotent)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'isna' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant isna introuvable – arrêt du seed services.';
    RETURN;
  END IF;

  INSERT INTO tenant_services (tenant_id, service_key, active)
  VALUES
    (v_tenant_id, 'school_engine',     true),
    (v_tenant_id, 'live_room',         true),
    (v_tenant_id, 'smartboard',        true),
    (v_tenant_id, 'creator_studio',    true),
    (v_tenant_id, 'admin_booking',     true),
    (v_tenant_id, 'marketing_creator', true),
    (v_tenant_id, 'neuro_recall',      true),
    (v_tenant_id, 'replay_system',     true)
  ON CONFLICT (tenant_id, service_key) DO UPDATE
    SET active = true, updated_at = now();
END;
$$;
