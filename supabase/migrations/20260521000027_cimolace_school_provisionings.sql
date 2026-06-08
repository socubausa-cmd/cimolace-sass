-- ============================================================================
-- Migration: Table cimolace_school_provisionings
-- Date: 2026-05-21
--
-- Objectif:
-- Tracer chaque école créée depuis le modèle ISNA Prorascience.
-- Conserve un snapshot complet de la config au moment du provisioning :
--   - tenant source (isna-prorascience)
--   - nouveau tenant créé
--   - client + site Cimolace associés
--   - propriétaire (email + user_id si connu)
--   - moteurs activés
--   - snapshot branding
--
-- Cette table est la mémoire opérationnelle du "modèle école ISNA".
-- Elle permet de rejouer ou d'auditer n'importe quel provisioning passé.
-- ============================================================================

-- ── Table principale ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cimolace_school_provisionings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Modèle source ──────────────────────────────────────────────────────
  source_tenant_slug  TEXT        NOT NULL DEFAULT 'isna-prorascience',

  -- ── Nouveau tenant applicatif ──────────────────────────────────────────
  new_tenant_id       UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  new_tenant_slug     TEXT        NOT NULL,

  -- ── Client + site Cimolace ─────────────────────────────────────────────
  client_id           UUID        REFERENCES cimolace_clients(id) ON DELETE SET NULL,
  site_id             UUID        REFERENCES cimolace_sites(id) ON DELETE SET NULL,

  -- ── Propriétaire de la nouvelle école ─────────────────────────────────
  owner_email         TEXT        NOT NULL,
  owner_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_method        TEXT        NOT NULL DEFAULT 'email_invitation'
                                  CHECK (owner_method IN ('direct_link', 'email_invitation')),

  -- ── Configuration appliquée ────────────────────────────────────────────
  plan                TEXT        NOT NULL DEFAULT 'school',
  domain              TEXT,
  engines_activated   TEXT[]      NOT NULL DEFAULT '{}',
  branding_snapshot   JSONB       NOT NULL DEFAULT '{}',
  billing_snapshot    JSONB       NOT NULL DEFAULT '{}',

  -- ── Méta opérateur ─────────────────────────────────────────────────────
  reason              TEXT,
  provisioned_by      TEXT        NOT NULL DEFAULT 'cimolace-backoffice',
  provisioned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Timestamps ─────────────────────────────────────────────────────────
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_school_prov_new_tenant
  ON cimolace_school_provisionings(new_tenant_id);

CREATE INDEX IF NOT EXISTS idx_school_prov_new_slug
  ON cimolace_school_provisionings(new_tenant_slug);

CREATE INDEX IF NOT EXISTS idx_school_prov_client
  ON cimolace_school_provisionings(client_id);

CREATE INDEX IF NOT EXISTS idx_school_prov_owner_email
  ON cimolace_school_provisionings(lower(owner_email));

CREATE INDEX IF NOT EXISTS idx_school_prov_provisioned_at
  ON cimolace_school_provisionings(provisioned_at DESC);

-- ── Trigger updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_prov_updated_at ON cimolace_school_provisionings;
CREATE TRIGGER school_prov_updated_at
  BEFORE UPDATE ON cimolace_school_provisionings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE cimolace_school_provisionings ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux staff Cimolace
DROP POLICY IF EXISTS "cimolace_staff_read_provisionings" ON cimolace_school_provisionings;
CREATE POLICY "cimolace_staff_read_provisionings"
  ON cimolace_school_provisionings
  FOR SELECT TO authenticated
  USING (public.is_cimolace_staff());

-- Insertion réservée au service_role (API backend)
DROP POLICY IF EXISTS "service_role_insert_provisionings" ON cimolace_school_provisionings;
CREATE POLICY "service_role_insert_provisionings"
  ON cimolace_school_provisionings
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Mise à jour réservée au service_role
DROP POLICY IF EXISTS "service_role_update_provisionings" ON cimolace_school_provisionings;
CREATE POLICY "service_role_update_provisionings"
  ON cimolace_school_provisionings
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Vue résumé (usage opérateur) ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_school_provisionings AS
SELECT
  sp.id,
  sp.source_tenant_slug,
  sp.new_tenant_slug,
  t.name                        AS school_name,
  t.plan                        AS tenant_plan,
  t.status                      AS tenant_status,
  sp.owner_email,
  sp.owner_method,
  sp.plan                       AS provisioning_plan,
  sp.domain,
  array_length(sp.engines_activated, 1) AS engine_count,
  sp.reason,
  sp.provisioned_at,
  sp.created_at
FROM cimolace_school_provisionings sp
LEFT JOIN tenants t ON t.id = sp.new_tenant_id
ORDER BY sp.provisioned_at DESC;

COMMENT ON TABLE cimolace_school_provisionings IS
  'Traçabilité de chaque école provisionnée depuis le modèle ISNA Prorascience.';

COMMENT ON COLUMN cimolace_school_provisionings.billing_snapshot IS
  'Snapshot de la facturation Cimolace créée pendant le provisioning école.';

COMMENT ON VIEW public.v_school_provisionings IS
  'Vue résumé des provisionings école pour le tableau de bord Cimolace.';
