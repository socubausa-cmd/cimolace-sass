-- Migration: pawapay_deposits
-- Trace chaque tentative de dépôt Mobile Money via pawaPay.
-- Le depositId (UUIDv4) est généré par notre API avant l'appel pawaPay
-- pour garantir l'idempotence même en cas d'erreur réseau.

CREATE TABLE IF NOT EXISTS pawapay_deposits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiant côté pawaPay (UUIDv4 généré par nous, renvoyé par pawaPay)
  deposit_id       UUID UNIQUE NOT NULL,

  -- Contexte business
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  live_session_id  UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,

  -- Montant
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
  currency         TEXT    NOT NULL, -- ex: 'XAF', 'RWF', 'GHS'

  -- Provider Mobile Money
  provider         TEXT NOT NULL, -- ex: 'MTN_MOMO_CMR', 'ORANGE_CMR'
  phone_number     TEXT NOT NULL,
  country          TEXT NOT NULL, -- ISO3 ex: 'CMR', 'RWA'

  -- Statut pawaPay (ACCEPTED → COMPLETED | FAILED | REJECTED | TIMED_OUT)
  pawapay_status   TEXT NOT NULL DEFAULT 'ACCEPTED',

  -- ID de transaction chez l'opérateur Mobile Money (renvoyé dans le callback)
  provider_tx_id   TEXT,

  -- Metadata optionnel renvoyé par pawaPay dans le callback
  failure_code     TEXT,
  failure_message  TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche par dépôt pawaPay
CREATE INDEX IF NOT EXISTS idx_pawapay_deposits_deposit_id
  ON pawapay_deposits(deposit_id);

-- Index pour lister les dépôts d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_pawapay_deposits_user
  ON pawapay_deposits(user_id);

-- Index pour les dépôts d'un tenant
CREATE INDEX IF NOT EXISTS idx_pawapay_deposits_tenant
  ON pawapay_deposits(tenant_id);

-- RLS — visible uniquement par l'utilisateur propriétaire du dépôt
ALTER TABLE pawapay_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pawapay_deposit_owner_select" ON pawapay_deposits;
CREATE POLICY "pawapay_deposit_owner_select"
  ON pawapay_deposits
  FOR SELECT
  USING (user_id = auth.uid());

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_pawapay_deposits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pawapay_deposits_updated_at ON pawapay_deposits;
CREATE TRIGGER trg_pawapay_deposits_updated_at
  BEFORE UPDATE ON pawapay_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_pawapay_deposits_updated_at();

COMMENT ON TABLE pawapay_deposits IS
  'Dépôts Mobile Money initiés via pawaPay. deposit_id = UUIDv4 généré avant appel API pour idempotence.';
