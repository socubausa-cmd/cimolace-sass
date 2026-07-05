-- ─────────────────────────────────────────────────────────────────────────────
-- live_join_codes — tickets d'entrée PROVISOIRES pour rejoindre un live (scénario A).
-- Le prof choisit à la création : « Lien de classe » (mode='class', rejouable par
-- toute la classe jusqu'à expiry) OU « Liens individuels » (mode='individual',
-- ONE-TIME anti-partage : status→'used' à la 1re entrée).
--
-- Séparation dure : ce code délivre un TOKEN DE SALLE (viewer LiveKit), JAMAIS une
-- membership. Contrairement au code OTP d'accès élève (L5, haché), le code de live
-- est un ticket court à faible enjeu, RÉ-AFFICHABLE par le prof (QR d'un lien de
-- classe) → stocké en clair, borné par expiry + one-time. 100 % additif.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_join_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  live_session_id  UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,

  code             TEXT NOT NULL,
  mode             TEXT NOT NULL DEFAULT 'class'
                       CHECK (mode IN ('class', 'individual')),
  status           TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'used', 'revoked', 'expired')),

  label            TEXT,                    -- nom de l'élève (lien individuel), optionnel
  expires_at       TIMESTAMPTZ,             -- NULL = jusqu'à la fin de la session
  used_at          TIMESTAMPTZ,
  used_by_name     TEXT,

  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_live_join_codes_session ON live_join_codes(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_join_codes_code    ON live_join_codes(tenant_id, code);

-- Accès serveur uniquement (service_role bypass RLS) — validation applicative.
ALTER TABLE live_join_codes ENABLE ROW LEVEL SECURITY;
