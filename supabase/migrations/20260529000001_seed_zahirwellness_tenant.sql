-- ─────────────────────────────────────────────────────────────────────────────
-- Seed : tenant Zahir Wellness + services MedOS + domaines + clé API
-- Idempotent — peut être rejoué sans effet de bord.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Créer (ou mettre à jour) le tenant Zahir Wellness
INSERT INTO tenants (
  name,
  slug,
  status,
  plan,
  primary_domain,
  brand_colors,
  timezone,
  locale,
  metadata
)
VALUES (
  'Zahir Wellness',
  'zahirwellness',
  'active',
  'pro',
  'zahirwellness.com',
  '{"primary": "#6d2e46", "secondary": "#1a1a2e", "accent": "#e8a0b4"}'::jsonb,
  'Europe/Paris',
  'fr',
  '{
    "branding": {
      "name": "Zahir Wellness",
      "fullName": "Zahir Wellness — Centre de bien-être holistique",
      "shortName": "Zahir",
      "primaryColor": "#6d2e46",
      "secondaryColor": "#1a1a2e",
      "accentColor": "#e8a0b4",
      "domain": "zahirwellness.com",
      "publicSiteOrigin": "https://zahirwellness.com"
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

-- 2. Activer les services MedOS pour Zahir Wellness
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'zahirwellness' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant zahirwellness introuvable – arrêt.';
    RETURN;
  END IF;

  INSERT INTO tenant_services (tenant_id, service_key, active)
  VALUES
    (v_tenant_id, 'med_ehr',        true),  -- Dossiers patients
    (v_tenant_id, 'med_notes',      true),  -- Notes SOAP
    (v_tenant_id, 'med_health',     true),  -- Journal de santé
    (v_tenant_id, 'med_forms',      true),  -- Formulaires médicaux
    (v_tenant_id, 'med_programs',   true),  -- Programmes de soins
    (v_tenant_id, 'wellness_engine', true)  -- Engine wellness Cimolace
  ON CONFLICT (tenant_id, service_key) DO UPDATE
    SET active = true, updated_at = now();

  RAISE NOTICE 'Services MedOS activés pour zahirwellness (tenant_id: %)', v_tenant_id;
END;
$$;

-- 3. Whitelister les domaines zahirwellness.com (embed_origin CORS)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'zahirwellness' LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  INSERT INTO tenant_domains (tenant_id, domain, usage, status)
  VALUES
    (v_tenant_id, 'zahirwellness.com',     'embed_origin', 'active'),
    (v_tenant_id, 'www.zahirwellness.com', 'embed_origin', 'active'),
    (v_tenant_id, 'localhost:3000',         'embed_origin', 'active')  -- dev local
  ON CONFLICT (domain, usage) DO UPDATE
    SET status = 'active', updated_at = now();

  RAISE NOTICE 'Domaines embed_origin whitelistés pour zahirwellness';
END;
$$;

-- 4. Insérer la clé API tenant (mdk_*) pré-générée
-- IMPORTANT : La valeur RAW de la clé est :
--   mdk_fb1c1e106168c7321660927668bbdef12a6540915a2d9a1fe50851a25a1ea4e5
-- Stockée ici uniquement sous forme de hash SHA-256 (jamais la valeur brute).
-- Ajouter la clé brute en variable d'environnement CIMOLACE_ZAHIR_API_KEY dans zahir-app.
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'zahirwellness' LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  INSERT INTO tenant_api_keys (
    tenant_id,
    label,
    key_prefix,
    key_hash
  )
  VALUES (
    v_tenant_id,
    'zahir-app production',
    'mdk_fb1c1e10',
    'aa3a2370e595979bc7c3d5ee45a68d8be86b4b106a8fb1e5d5a7f17886faebea'
  )
  ON CONFLICT (key_hash) DO NOTHING;

  RAISE NOTICE 'Clé API mdk_fb1c1e10... insérée pour zahirwellness';
END;
$$;
