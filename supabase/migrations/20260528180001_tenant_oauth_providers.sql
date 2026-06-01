-- Migration: Custom per-tenant Google OAuth credentials
-- Tables: tenant_oauth_providers, oauth_states
-- Applied: 2026-05-28

-- ─── 1. tenant_oauth_providers ───────────────────────────────────────────────
-- Stores Google (and future providers) OAuth credentials per tenant.
-- The client_secret is stored server-side; edge functions read it via service role.
-- Tenant admins/owners manage their own credentials from the admin dashboard.

CREATE TABLE IF NOT EXISTS tenant_oauth_providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'google',
  client_id             TEXT NOT NULL,
  client_secret         TEXT NOT NULL,
  app_name              TEXT,
  authorized_redirect_uri TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_top_tenant ON tenant_oauth_providers(tenant_id);
ALTER TABLE tenant_oauth_providers ENABLE ROW LEVEL SECURITY;

-- Tenant owners/admins can SELECT their own OAuth config
DO $$ BEGIN
  CREATE POLICY top_select_own ON tenant_oauth_providers
    FOR SELECT TO authenticated
    USING (
      tenant_id IN (
        SELECT tenant_id FROM tenant_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant owners/admins can INSERT new OAuth config
DO $$ BEGIN
  CREATE POLICY top_insert_own ON tenant_oauth_providers
    FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id IN (
        SELECT tenant_id FROM tenant_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant owners/admins can UPDATE their OAuth config
DO $$ BEGIN
  CREATE POLICY top_update_own ON tenant_oauth_providers
    FOR UPDATE TO authenticated
    USING (
      tenant_id IN (
        SELECT tenant_id FROM tenant_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    )
    WITH CHECK (
      tenant_id IN (
        SELECT tenant_id FROM tenant_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant owners can DELETE their OAuth config
DO $$ BEGIN
  CREATE POLICY top_delete_own ON tenant_oauth_providers
    FOR DELETE TO authenticated
    USING (
      tenant_id IN (
        SELECT tenant_id FROM tenant_memberships
        WHERE user_id = auth.uid()
          AND role = 'owner'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. oauth_states ─────────────────────────────────────────────────────────
-- Short-lived CSRF state tokens for the custom OAuth flow.
-- Written by oauth-initiate edge function; read+deleted by oauth-callback.
-- No user-facing RLS policies — service role bypasses RLS.

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  return_to   TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires  ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_tenant   ON oauth_states(tenant_slug);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (edge functions) can access this table.
-- Expired rows will be cleaned up by the callback function + periodic cleanup.
