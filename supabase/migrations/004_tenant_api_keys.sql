-- MedOS Bridge: Tenant API Keys
-- Permet à un site externe (ex: Zahir Wellness) de s'authentifier auprès de MedOS
-- sans compte Supabase — via une clé API par tenant.

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,                     -- ex: "mdk_zahir" affiché dans l'UI
  key_hash    TEXT NOT NULL UNIQUE,               -- SHA-256 de la clé brute (jamais stockée)
  created_by  UUID,                              -- user_id Supabase du créateur
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash   ON tenant_api_keys(key_hash);

ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON tenant_api_keys TO service_role USING (true) WITH CHECK (true);
