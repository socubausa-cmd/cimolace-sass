-- ============================================================
-- Billing / Subscriptions (multi-payment providers)
-- - CinetPay (mobile money)
-- - NOWPayments (Monero XMR)
-- ============================================================

-- 0) Helper: updated_at trigger (idempotent)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN others THEN
  -- ignore
END $$;

-- 1) Plans
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  interval_type TEXT NOT NULL CHECK (interval_type IN ('monthly', 'quarterly', 'yearly')),
  price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
  price_currency TEXT NOT NULL DEFAULT 'EUR',
  active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER trg_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Subscriptions
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'canceled', 'past_due')),
  provider TEXT NOT NULL CHECK (provider IN ('cinetpay', 'nowpayments')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money', 'monero')),
  crypto_currency TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  renewed_from UUID REFERENCES public.billing_subscriptions(id),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_crypto_check CHECK (
    (payment_method = 'monero' AND crypto_currency IS NOT NULL) OR
    (payment_method = 'mobile_money' AND crypto_currency IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user ON public.billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_expires ON public.billing_subscriptions(expires_at);

DO $$ BEGIN
  CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) Payments (provider-agnostic)
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id),

  provider TEXT NOT NULL CHECK (provider IN ('cinetpay', 'nowpayments')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money', 'monero')),

  -- Provider identifiers (idempotence)
  provider_payment_id TEXT,
  order_id TEXT NOT NULL,

  -- Unified statuses
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'partially_paid', 'confirming', 'confirmed', 'expired', 'failed', 'refunded')
  ),

  -- Fiat
  price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
  price_currency TEXT NOT NULL DEFAULT 'EUR',

  -- Crypto (optional)
  pay_amount NUMERIC(20,8),
  pay_currency TEXT,
  actually_paid NUMERIC(20,8),

  -- Display / checkout details
  pay_address TEXT,
  payment_url TEXT,
  qr_url TEXT,
  expires_at TIMESTAMPTZ,

  -- Raw webhook payloads / debug
  ipn_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT billing_payments_provider_payment_id_unique UNIQUE (provider, provider_payment_id),
  CONSTRAINT billing_payments_order_id_unique UNIQUE (order_id),
  CONSTRAINT billing_payments_crypto_check CHECK (
    (payment_method = 'monero' AND pay_currency IS NOT NULL) OR
    (payment_method = 'mobile_money' AND pay_currency IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_user ON public.billing_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON public.billing_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription ON public.billing_payments(subscription_id);

DO $$ BEGIN
  CREATE TRIGGER trg_billing_payments_updated_at
  BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Webhook logs
CREATE TABLE IF NOT EXISTS public.billing_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('cinetpay', 'nowpayments')),
  event_type TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_provider ON public.billing_webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_processed ON public.billing_webhook_logs(processed);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Drop if exist (safe)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Billing plans: public read" ON public.billing_plans;
  DROP POLICY IF EXISTS "Billing plans: admin write" ON public.billing_plans;
  DROP POLICY IF EXISTS "Billing subs: read own" ON public.billing_subscriptions;
  DROP POLICY IF EXISTS "Billing subs: admin write" ON public.billing_subscriptions;
  DROP POLICY IF EXISTS "Billing payments: read own" ON public.billing_payments;
  DROP POLICY IF EXISTS "Billing payments: admin write" ON public.billing_payments;
  DROP POLICY IF EXISTS "Billing webhook logs: admin read" ON public.billing_webhook_logs;
  DROP POLICY IF EXISTS "Billing webhook logs: admin write" ON public.billing_webhook_logs;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Plans readable by all (for pricing page)
CREATE POLICY "Billing plans: public read" ON public.billing_plans
FOR SELECT USING (active = true);

CREATE POLICY "Billing plans: admin write" ON public.billing_plans
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Subscriptions: user can read own; admin/owner can read all
CREATE POLICY "Billing subs: read own" ON public.billing_subscriptions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "Billing subs: admin write" ON public.billing_subscriptions
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Payments: user can read own; admin/owner can read all
CREATE POLICY "Billing payments: read own" ON public.billing_payments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "Billing payments: admin write" ON public.billing_payments
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Webhook logs: admin/owner read/write only
CREATE POLICY "Billing webhook logs: admin read" ON public.billing_webhook_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "Billing webhook logs: admin write" ON public.billing_webhook_logs
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

