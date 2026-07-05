-- ─────────────────────────────────────────────────────────────────────────────
-- paypal_orders — ordres PayPal Orders v2 des OFFRES élève (abonnement / consultation
-- / don). Miroir de `pawapay_deposits`, adapté au modèle offre (kind + plan_slug).
-- Persiste le contexte AVANT l'approbation PayPal → à la capture, on relit user/plan
-- et on fulfill (membership/reçu) via le même chemin que PawaPay/Stripe. Le statut
-- fait foi côté PayPal (capture serveur) ; la transition COMPLETED est atomique.
-- 100 % ADDITIF (CREATE IF NOT EXISTS) — n'altère aucune table existante.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paypal_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Id de l'ordre côté PayPal (renvoyé par create-order ; relu à la capture).
  order_id         TEXT UNIQUE NOT NULL,

  -- Contexte business
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Montant (calculé SERVEUR)
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
  currency         TEXT    NOT NULL DEFAULT 'EUR',

  -- Nature de l'offre
  kind             TEXT NOT NULL,              -- 'subscription' | 'consultation' | 'donation'
  plan_slug        TEXT,                       -- billing_plans.key pour un abonnement

  -- Statut PayPal (CREATED → APPROVED → COMPLETED | VOIDED)
  status           TEXT NOT NULL DEFAULT 'CREATED',
  capture_id       TEXT,                       -- id de la capture PayPal (audit)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paypal_orders_user   ON paypal_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_orders_tenant ON paypal_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paypal_orders_status ON paypal_orders(status);

-- RLS : accès serveur uniquement (service_role bypass RLS). Aucune policy pour
-- `authenticated` → aucun client ne lit/écrit directement (comme pawapay_deposits).
ALTER TABLE paypal_orders ENABLE ROW LEVEL SECURITY;
