-- ═════════════════════════════════════════════════════════════════════════════
-- LIRI AI BILLING — Système de facturation IA (style Claude AI / OpenAI)
--
-- Unité universelle : LIRI Credit (1 LCR = €0.001 ≈ 0.001 USD)
-- Chaque appel IA coûte un nombre de crédits selon le modèle.
--
-- Flow :
--   1. Tenant s'abonne → reçoit un quota mensuel auto-rechargé
--   2. Chaque appel IA → décrémente le solde (logged dans ai_usage_events)
--   3. Si solde < coût → 402 PaymentRequired
--   4. Tenant peut acheter des packs supplémentaires (top-up)
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1. Balance courante par tenant ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_credit_balances (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance_credits    NUMERIC(18,4) NOT NULL DEFAULT 0,    -- solde actuel
  monthly_quota      NUMERIC(18,4) NOT NULL DEFAULT 0,    -- inclus dans l'abonnement
  next_refill_at     TIMESTAMPTZ,                          -- prochain rechargement auto
  plan_tier          TEXT DEFAULT 'free',                 -- free | starter | pro | business
  is_blocked         BOOLEAN NOT NULL DEFAULT false,      -- bloqué pour dépassement
  total_consumed     NUMERIC(18,4) NOT NULL DEFAULT 0,    -- consommation totale lifetime
  total_purchased    NUMERIC(18,4) NOT NULL DEFAULT 0,    -- crédits achetés lifetime
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_balances_tier ON ai_credit_balances(plan_tier);

-- ─── 2. Ledger : toutes les transactions de crédits ─────────────────────────
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount       NUMERIC(18,4) NOT NULL,                    -- positif = crédit, négatif = débit
  balance_after NUMERIC(18,4) NOT NULL,                   -- solde après opération
  type         TEXT NOT NULL,                              -- subscription_refill | topup_purchase | ai_usage | refund | adjustment
  reference    TEXT,                                       -- stripe_session_id, ai_usage_event_id, etc.
  description  TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_tenant ON ai_credit_transactions(tenant_id, created_at DESC);
CREATE INDEX idx_credit_tx_type ON ai_credit_transactions(type);

-- ─── 3. Événements d'usage IA (log détaillé par appel) ──────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID,                                   -- qui a déclenché (peut être null pour batch)
  function_name    TEXT NOT NULL,                          -- ex: liri-tts, generate-mindmap
  model            TEXT,                                   -- claude-3-sonnet, gpt-4o, whisper-1, eleven_flash_v2_5
  provider         TEXT,                                   -- anthropic | openai | deepseek | groq | elevenlabs | google
  unit_type        TEXT NOT NULL,                          -- tokens_in | tokens_out | chars | seconds | images | requests
  unit_amount      NUMERIC(18,4) NOT NULL,                 -- quantité d'unités utilisées
  credits_charged  NUMERIC(18,4) NOT NULL,                 -- crédits débités
  session_id       UUID,                                   -- ref à live_sessions si applicable
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_date ON ai_usage_events(tenant_id, created_at DESC);
CREATE INDEX idx_usage_function ON ai_usage_events(function_name);
CREATE INDEX idx_usage_session ON ai_usage_events(session_id);

-- ─── 4. Catalogue de prix par modèle/provider ───────────────────────────────
CREATE TABLE IF NOT EXISTS ai_pricing (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  unit_type      TEXT NOT NULL,                            -- tokens_in | tokens_out | chars | seconds | images | requests
  credits_per_unit NUMERIC(18,8) NOT NULL,                 -- combien de crédits par unité
  unit_label     TEXT,                                     -- "1K tokens entrée", "1 seconde audio", "1 image", etc.
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, model, unit_type)
);

-- ─── 5. Packs de recharge disponibles ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_topup_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT UNIQUE NOT NULL,                    -- ex: 'pack_1k', 'pack_5k'
  label           TEXT NOT NULL,
  credits_amount  NUMERIC(18,4) NOT NULL,
  price_cents     INT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  bonus_label     TEXT,                                     -- ex: "+10% bonus"
  stripe_price_id TEXT,                                     -- price_xxx Stripe
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. Configuration quota par plan abonnement ─────────────────────────────
CREATE TABLE IF NOT EXISTS ai_plan_quotas (
  plan_tier       TEXT PRIMARY KEY,                        -- free | starter | pro | business
  monthly_credits NUMERIC(18,4) NOT NULL,
  rollover_max    NUMERIC(18,4) DEFAULT 0,                 -- max crédits non-utilisés reportés
  allow_overage   BOOLEAN NOT NULL DEFAULT false,           -- débit au-delà du solde (B2B prepay only)
  description     TEXT
);

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS — chaque tenant ne voit que ses propres données
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE ai_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_topup_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_plan_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_balances" ON ai_credit_balances TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_tx" ON ai_credit_transactions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_usage" ON ai_usage_events TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_pricing" ON ai_pricing TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_topup" ON ai_topup_packages TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_quotas" ON ai_plan_quotas TO service_role USING (true) WITH CHECK (true);

-- Pricing et packs sont public-read pour affichage UI
CREATE POLICY "public_read_pricing" ON ai_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "public_read_topup" ON ai_topup_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "public_read_quotas" ON ai_plan_quotas FOR SELECT TO authenticated USING (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- SEED — Pricing initial
-- 1 LIRI Credit (LCR) = ~€0.001 ≈ $0.001
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO ai_pricing (provider, model, unit_type, credits_per_unit, unit_label) VALUES
  -- DeepSeek (très bon marché — modèle par défaut)
  ('deepseek', 'deepseek-chat',   'tokens_in',  0.00014, '1 token entrée'),
  ('deepseek', 'deepseek-chat',   'tokens_out', 0.00028, '1 token sortie'),
  ('deepseek', 'deepseek-coder',  'tokens_in',  0.00014, '1 token entrée'),
  -- Anthropic Claude
  ('anthropic', 'claude-3-5-sonnet-20241022', 'tokens_in',  0.003, '1 token entrée'),
  ('anthropic', 'claude-3-5-sonnet-20241022', 'tokens_out', 0.015, '1 token sortie'),
  ('anthropic', 'claude-3-5-haiku-20241022',  'tokens_in',  0.0008, '1 token entrée'),
  ('anthropic', 'claude-3-5-haiku-20241022',  'tokens_out', 0.004, '1 token sortie'),
  -- OpenAI
  ('openai', 'gpt-4o',     'tokens_in',  0.0025, '1 token entrée'),
  ('openai', 'gpt-4o',     'tokens_out', 0.01, '1 token sortie'),
  ('openai', 'gpt-4o-mini', 'tokens_in',  0.00015, '1 token entrée'),
  ('openai', 'gpt-4o-mini', 'tokens_out', 0.0006, '1 token sortie'),
  ('openai', 'whisper-1',  'seconds',    0.1,   '1 seconde audio'),
  ('openai', 'dall-e-3',   'images',     40,    '1 image 1024x1024'),
  -- Groq (Whisper rapide)
  ('groq',   'whisper-large-v3', 'seconds', 0.04, '1 seconde audio'),
  -- ElevenLabs TTS
  ('elevenlabs', 'eleven_flash_v2_5', 'chars', 0.05, '1 caractère synthétisé'),
  ('elevenlabs', 'eleven_multilingual_v2', 'chars', 0.08, '1 caractère synthétisé premium'),
  -- Google Cloud TTS (fallback)
  ('google', 'tts-neural', 'chars', 0.016, '1 caractère TTS Google')
ON CONFLICT (provider, model, unit_type) DO NOTHING;

-- Packs de recharge
INSERT INTO ai_topup_packages (key, label, credits_amount, price_cents, currency, bonus_label, sort_order) VALUES
  ('pack_1k',  'Pack Starter — 1 000 crédits',   1000,  1500,  'EUR', NULL,        10),
  ('pack_5k',  'Pack Pro — 5 500 crédits',       5500,  7000,  'EUR', '+10 % bonus', 20),
  ('pack_20k', 'Pack Business — 24 000 crédits', 24000, 25000, 'EUR', '+20 % bonus', 30),
  ('pack_100k','Pack Entreprise — 130 000 crédits', 130000, 100000, 'EUR', '+30 % bonus', 40)
ON CONFLICT (key) DO NOTHING;

-- Quotas par plan
INSERT INTO ai_plan_quotas (plan_tier, monthly_credits, rollover_max, allow_overage, description) VALUES
  ('free',     500,    0,    false, 'Essai gratuit — 500 crédits/mois'),
  ('starter',  2000,   500,  false, 'Starter — 2 000 crédits/mois'),
  ('pro',      10000,  3000, false, 'Pro — 10 000 crédits/mois + report 3 000'),
  ('business', 50000,  20000, true,  'Business — 50 000 crédits/mois + report 20 000 + overdraft')
ON CONFLICT (plan_tier) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  rollover_max = EXCLUDED.rollover_max,
  allow_overage = EXCLUDED.allow_overage,
  description = EXCLUDED.description;

-- ═════════════════════════════════════════════════════════════════════════════
-- HELPER : initialiser le solde d'un nouveau tenant
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION init_tenant_ai_balance(p_tenant_id UUID, p_plan TEXT DEFAULT 'free')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quota NUMERIC(18,4);
BEGIN
  SELECT monthly_credits INTO v_quota FROM ai_plan_quotas WHERE plan_tier = p_plan;
  IF v_quota IS NULL THEN v_quota := 500; END IF;

  INSERT INTO ai_credit_balances (tenant_id, balance_credits, monthly_quota, plan_tier, next_refill_at)
  VALUES (p_tenant_id, v_quota, v_quota, p_plan, NOW() + INTERVAL '1 month')
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    monthly_quota = EXCLUDED.monthly_quota;

  INSERT INTO ai_credit_transactions (tenant_id, amount, balance_after, type, description)
  VALUES (p_tenant_id, v_quota, v_quota, 'subscription_refill', 'Quota initial — plan ' || p_plan);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPC : Débiter des crédits (appelé par l'API IA après chaque appel)
-- Atomique, transactionnel. Renvoie le nouveau solde ou erreur si insuffisant.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION debit_ai_credits(
  p_tenant_id UUID,
  p_amount NUMERIC,
  p_function_name TEXT,
  p_model TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_unit_type TEXT DEFAULT 'tokens_in',
  p_unit_amount NUMERIC DEFAULT 0,
  p_session_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance NUMERIC(18,4);
  v_allow_overage BOOLEAN;
  v_blocked BOOLEAN;
  v_new_balance NUMERIC(18,4);
  v_usage_id UUID;
BEGIN
  SELECT balance_credits, is_blocked INTO v_balance, v_blocked
  FROM ai_credit_balances WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-init si pas encore initialisé
    PERFORM init_tenant_ai_balance(p_tenant_id, 'free');
    SELECT balance_credits INTO v_balance FROM ai_credit_balances WHERE tenant_id = p_tenant_id FOR UPDATE;
  END IF;

  IF v_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'TENANT_BLOCKED', 'message', 'Compte IA suspendu');
  END IF;

  SELECT allow_overage INTO v_allow_overage
  FROM ai_plan_quotas q JOIN ai_credit_balances b ON b.plan_tier = q.plan_tier
  WHERE b.tenant_id = p_tenant_id;

  IF v_balance < p_amount AND NOT COALESCE(v_allow_overage, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CREDITS',
      'message', 'Solde insuffisant. Achetez un pack de crédits supplémentaires.',
      'balance', v_balance,
      'required', p_amount
    );
  END IF;

  v_new_balance := v_balance - p_amount;

  -- Insérer l'usage event
  INSERT INTO ai_usage_events (tenant_id, user_id, function_name, model, provider, unit_type, unit_amount, credits_charged, session_id, metadata)
  VALUES (p_tenant_id, p_user_id, p_function_name, p_model, p_provider, p_unit_type, p_unit_amount, p_amount, p_session_id, p_metadata)
  RETURNING id INTO v_usage_id;

  -- Mettre à jour le solde
  UPDATE ai_credit_balances
  SET balance_credits = v_new_balance,
      total_consumed = total_consumed + p_amount,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Ledger
  INSERT INTO ai_credit_transactions (tenant_id, amount, balance_after, type, reference, description, metadata)
  VALUES (p_tenant_id, -p_amount, v_new_balance, 'ai_usage', v_usage_id::text,
          p_function_name || ' (' || COALESCE(p_model,'') || ')',
          p_metadata);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'charged', p_amount,
    'usage_id', v_usage_id
  );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPC : Créditer (achat de pack ou refill abonnement)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION credit_ai_credits(
  p_tenant_id UUID,
  p_amount NUMERIC,
  p_type TEXT,            -- 'topup_purchase' | 'subscription_refill' | 'refund' | 'adjustment'
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_balance NUMERIC(18,4);
BEGIN
  -- Assurer que le tenant a un balance
  INSERT INTO ai_credit_balances (tenant_id, balance_credits, plan_tier)
  VALUES (p_tenant_id, 0, 'free')
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE ai_credit_balances
  SET balance_credits = balance_credits + p_amount,
      total_purchased = total_purchased + CASE WHEN p_type = 'topup_purchase' THEN p_amount ELSE 0 END,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING balance_credits INTO v_new_balance;

  INSERT INTO ai_credit_transactions (tenant_id, amount, balance_after, type, reference, description, metadata)
  VALUES (p_tenant_id, p_amount, v_new_balance, p_type, p_reference, p_description, p_metadata);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'credited', p_amount);
END;
$$;

COMMENT ON TABLE ai_credit_balances IS 'Solde de crédits IA par tenant (LIRI Credits)';
COMMENT ON TABLE ai_usage_events IS 'Log détaillé de chaque appel IA pour audit et facturation';
COMMENT ON FUNCTION debit_ai_credits IS 'Débit atomique des crédits IA — utilisé par toutes les Edge Functions';
