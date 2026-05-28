-- MEDOS S1.3 / S5 — Domaines tenant (custom domains + embed origins)
--
-- Cette table sert à deux choses :
--   1. (S1) Whitelister les Origin HTTP autorisés à appeler /v1/medos/embed-token
--      et charger le widget embed.js (CORS dynamique).
--   2. (S5) Provisionner des domaines personnalisés pour Mode B (clinique-x.ga)
--      où Cimolace héberge l'expérience sous le domaine du client.
--
-- Pour l'instant on n'utilise que l'usage embed-origin. Le SSL et la
-- vérification DNS seront implémentés au sprint S5.

CREATE TABLE IF NOT EXISTS tenant_domains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Domaine FQDN (sans protocole, sans path). Ex : 'zahirwellness.com'
  domain        TEXT NOT NULL,
  -- Usage : 'embed_origin' = autorisé à charger widget + obtenir embed-token
  --         'custom_host'  = sert l'expérience MEDOS sous ce domaine (Mode B)
  usage         TEXT NOT NULL DEFAULT 'embed_origin'
                  CHECK (usage IN ('embed_origin','custom_host')),
  -- Statut de vérification DNS (pour custom_host) ou simplement 'active' (embed_origin)
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('pending','active','revoked')),
  -- Token de vérification DNS (utilisé en Mode B uniquement)
  verify_token  TEXT,
  verified_at   TIMESTAMPTZ,
  -- Statut SSL pour Mode B (Cloudflare for SaaS)
  ssl_status    TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (domain, usage)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(domain);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_lookup
  ON tenant_domains(domain, usage, status);

ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;

-- service_role écrit (provisioning par l'admin Cimolace + l'API embed)
CREATE POLICY "service_role_full_access_tenant_domains"
  ON tenant_domains TO service_role USING (true) WITH CHECK (true);

-- Membres du tenant peuvent voir leurs propres domaines
CREATE POLICY "members_read_own_tenant_domains"
  ON tenant_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenant_domains.tenant_id
        AND tenant_memberships.user_id = auth.uid()
        AND tenant_memberships.status = 'active'
    )
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS tenant_domains_updated_at ON tenant_domains;
CREATE TRIGGER tenant_domains_updated_at
  BEFORE UPDATE ON tenant_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
