-- Team invitations, privileged links, role permissions, access audit
-- Cahier des charges: système d'invitation, attribution de rôles, liens privilégiés

-- 1) team_invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL,
  permissions_initial JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_invite_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  custom_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON public.team_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_by ON public.team_invitations(invited_by);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team invitations: owner admin read" ON public.team_invitations;
CREATE POLICY "Team invitations: owner admin read"
ON public.team_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Team invitations: owner admin insert" ON public.team_invitations;
CREATE POLICY "Team invitations: owner admin insert"
ON public.team_invitations FOR INSERT
WITH CHECK (
  invited_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Team invitations: owner admin update" ON public.team_invitations;
CREATE POLICY "Team invitations: owner admin update"
ON public.team_invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

-- 2) privileged_links (owner only)
CREATE TABLE IF NOT EXISTS public.privileged_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT,
  plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  duration_days INT NOT NULL DEFAULT 30,
  max_uses INT,
  use_count INT NOT NULL DEFAULT 0,
  single_use BOOLEAN NOT NULL DEFAULT false,
  restricted_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  role_to_assign TEXT,
  access_type TEXT NOT NULL DEFAULT 'full'
    CHECK (access_type IN ('full', 'partial', 'test', 'demo')),
  internal_note TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'used_up')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privileged_links_slug ON public.privileged_links(slug);
CREATE INDEX IF NOT EXISTS idx_privileged_links_status ON public.privileged_links(status);
CREATE INDEX IF NOT EXISTS idx_privileged_links_created_by ON public.privileged_links(created_by);

ALTER TABLE public.privileged_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged links: owner read" ON public.privileged_links;
CREATE POLICY "Privileged links: owner read"
ON public.privileged_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'owner'
  )
);

DROP POLICY IF EXISTS "Privileged links: owner insert" ON public.privileged_links;
CREATE POLICY "Privileged links: owner insert"
ON public.privileged_links FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'owner'
  )
);

DROP POLICY IF EXISTS "Privileged links: owner update" ON public.privileged_links;
CREATE POLICY "Privileged links: owner update"
ON public.privileged_links FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'owner'
  )
);

-- 2b) privileged_access_grants (accès temporaire sans paiement, indépendant de billing_subscriptions)
CREATE TABLE IF NOT EXISTS public.privileged_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.privileged_links(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  access_start TIMESTAMPTZ NOT NULL,
  access_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privileged_access_grants_user ON public.privileged_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_privileged_access_grants_end ON public.privileged_access_grants(access_end);

ALTER TABLE public.privileged_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged access: read own" ON public.privileged_access_grants;
CREATE POLICY "Privileged access: read own"
ON public.privileged_access_grants FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

-- 3) privileged_link_redemptions (trace)
CREATE TABLE IF NOT EXISTS public.privileged_link_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.privileged_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privileged_link_redemptions_link ON public.privileged_link_redemptions(link_id);
CREATE INDEX IF NOT EXISTS idx_privileged_link_redemptions_user ON public.privileged_link_redemptions(user_id);

ALTER TABLE public.privileged_link_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Redemptions: owner admin read" ON public.privileged_link_redemptions;
CREATE POLICY "Redemptions: owner admin read"
ON public.privileged_link_redemptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

-- 4) role_permissions (définition des permissions par rôle)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  scope TEXT,
  UNIQUE(role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- 5) permission_overrides (droits ajoutés ou retirés par utilisateur)
CREATE TABLE IF NOT EXISTS public.permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  scope TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_user ON public.permission_overrides(user_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role permissions: owner admin read" ON public.role_permissions;
CREATE POLICY "Role permissions: owner admin read"
ON public.role_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Role permissions: owner admin manage" ON public.role_permissions;
CREATE POLICY "Role permissions: owner admin manage"
ON public.role_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Permission overrides: owner admin read" ON public.permission_overrides;
CREATE POLICY "Permission overrides: owner admin read"
ON public.permission_overrides FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Permission overrides: owner admin manage" ON public.permission_overrides;
CREATE POLICY "Permission overrides: owner admin manage"
ON public.permission_overrides FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

-- 6) access_audit_log (journal des changements d'accès)
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_log_actor ON public.access_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_target ON public.access_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_created ON public.access_audit_log(created_at DESC);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access audit: owner admin read" ON public.access_audit_log;
CREATE POLICY "Access audit: owner admin read"
ON public.access_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Access audit: owner admin insert" ON public.access_audit_log;
CREATE POLICY "Access audit: owner admin insert"
ON public.access_audit_log FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
  )
);

-- 7) Extend profiles.role (ajouter nouveaux rôles si la contrainte existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'owner', 'admin', 'teacher', 'secretariat', 'creator', 'proche', 'student',
    'commercial', 'support', 'content_editor', 'admin_limite', 'visitor'
  ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8) Seed permissions de base (optionnel)
INSERT INTO public.role_permissions (role, permission_key, granted)
VALUES
  ('owner', 'all', true),
  ('admin', 'manage_users', true),
  ('admin', 'manage_billing', true),
  ('admin', 'manage_content', true),
  ('admin', 'manage_invitations', true),
  ('admin', 'create_privileged_links', false),
  ('teacher', 'manage_classes', true),
  ('teacher', 'manage_grades', true),
  ('teacher', 'publish_announcements', false),
  ('secretariat', 'process_enrollments', true),
  ('secretariat', 'process_billing', true),
  ('secretariat', 'view_inbox', true)
ON CONFLICT (role, permission_key) DO NOTHING;
