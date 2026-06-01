-- ============================================================================
-- Migration: Table tenant_invitations
-- Date: 2026-05-21
--
-- Objectif:
-- Stocker les invitations email en attente quand un owner_email n'a pas encore
-- de compte Supabase Auth. Utilisé par provisionSchoolFromTemplate quand
-- owner_method = 'email_invitation'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'owner'
                             CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  token          TEXT        NOT NULL UNIQUE,   -- base64url signé, à valider côté auth
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by     TEXT,                          -- email ou user_id de l'opérateur
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant
  ON tenant_invitations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email
  ON tenant_invitations(lower(email));

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token
  ON tenant_invitations(token);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_status
  ON tenant_invitations(status)
  WHERE status = 'pending';

-- ── Trigger updated_at ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tenant_invitations_updated_at ON tenant_invitations;
CREATE TRIGGER tenant_invitations_updated_at
  BEFORE UPDATE ON tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Un user peut voir ses propres invitations
DROP POLICY IF EXISTS "user_read_own_invitations" ON tenant_invitations;
CREATE POLICY "user_read_own_invitations"
  ON tenant_invitations
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Les admins du tenant peuvent voir toutes les invitations du tenant
DROP POLICY IF EXISTS "tenant_admin_read_invitations" ON tenant_invitations;
CREATE POLICY "tenant_admin_read_invitations"
  ON tenant_invitations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = tenant_invitations.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  );

-- Insertion / mise à jour réservées au service_role (backend)
DROP POLICY IF EXISTS "service_role_manage_invitations" ON tenant_invitations;
CREATE POLICY "service_role_manage_invitations"
  ON tenant_invitations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE tenant_invitations IS
  'Invitations email en attente pour rejoindre un tenant. Créées quand le owner_email est inconnu de Supabase Auth.';
