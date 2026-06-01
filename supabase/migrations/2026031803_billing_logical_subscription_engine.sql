-- ============================================================
-- Logical subscription engine for monthly renewals via Chariow
-- - Chariow remains one-time checkout
-- - Application controls renewal lifecycle
-- ============================================================

-- 1) Plans: add business fields if missing
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS chariow_product_id TEXT;

DO $$
BEGIN
  -- Backfill duration_days from interval_type where missing.
  UPDATE public.billing_plans
  SET duration_days = CASE lower(interval_type)
    WHEN 'monthly' THEN 30
    WHEN 'quarterly' THEN 90
    WHEN 'yearly' THEN 365
    ELSE 30
  END
  WHERE duration_days IS NULL OR duration_days <= 0;
END
$$;

-- 2) Subscriptions: renewal lifecycle fields
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS renewal_strategy TEXT NOT NULL DEFAULT 'auto_link_generation',
  ADD COLUMN IF NOT EXISTS last_payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_renewal_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_stage TEXT NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_subscriptions_renewal_strategy_check'
  ) THEN
    ALTER TABLE public.billing_subscriptions
      ADD CONSTRAINT billing_subscriptions_renewal_strategy_check
      CHECK (renewal_strategy IN ('manual_link', 'auto_link_generation'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_subscriptions_reminder_stage_check'
  ) THEN
    ALTER TABLE public.billing_subscriptions
      ADD CONSTRAINT billing_subscriptions_reminder_stage_check
      CHECK (reminder_stage IN ('none', 'd7', 'd3', 'd1', 'expired', 'winback'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_next_renewal
  ON public.billing_subscriptions(next_renewal_due_at);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_reminder_stage
  ON public.billing_subscriptions(reminder_stage);

-- 3) Payments: renewal metadata
ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS provider_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_product_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB,
  ADD COLUMN IF NOT EXISTS renewal_for_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_payments_payment_type_check'
  ) THEN
    ALTER TABLE public.billing_payments
      ADD CONSTRAINT billing_payments_payment_type_check
      CHECK (payment_type IN ('initial', 'renewal'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_billing_payments_payment_type
  ON public.billing_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_billing_payments_renewal_for_sub
  ON public.billing_payments(renewal_for_subscription_id);

-- 4) Renewal links
CREATE TABLE IF NOT EXISTS public.billing_renewal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  checkout_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_renewal_links_subscription
  ON public.billing_renewal_links(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_renewal_links_status
  ON public.billing_renewal_links(status, expires_at);

DO $$
BEGIN
  CREATE TRIGGER trg_billing_renewal_links_updated_at
  BEFORE UPDATE ON public.billing_renewal_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- 5) Subscription reminders
CREATE TABLE IF NOT EXISTS public.billing_subscription_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN ('d7', 'd3', 'd1', 'expired', 'winback')),
  channel TEXT NOT NULL
    CHECK (channel IN ('email', 'whatsapp', 'in_app')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscription_reminders_subscription
  ON public.billing_subscription_reminders(subscription_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_billing_subscription_reminders_user
  ON public.billing_subscription_reminders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_subscription_reminders_status
  ON public.billing_subscription_reminders(status, scheduled_for);

-- 6) Access logs
CREATE TABLE IF NOT EXISTS public.billing_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('granted', 'renewed', 'expired', 'restored', 'blocked')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_access_logs_user
  ON public.billing_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_access_logs_subscription
  ON public.billing_access_logs(subscription_id, created_at DESC);

-- 7) RLS
ALTER TABLE public.billing_renewal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscription_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_access_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Billing renewal links: read own" ON public.billing_renewal_links;
  DROP POLICY IF EXISTS "Billing renewal links: admin write" ON public.billing_renewal_links;
  DROP POLICY IF EXISTS "Billing reminders: read own" ON public.billing_subscription_reminders;
  DROP POLICY IF EXISTS "Billing reminders: admin write" ON public.billing_subscription_reminders;
  DROP POLICY IF EXISTS "Billing access logs: read own" ON public.billing_access_logs;
  DROP POLICY IF EXISTS "Billing access logs: admin write" ON public.billing_access_logs;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY "Billing renewal links: read own" ON public.billing_renewal_links
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.billing_subscriptions bs
    WHERE bs.id = billing_renewal_links.subscription_id
      AND (
        bs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
      )
  )
);

CREATE POLICY "Billing renewal links: admin write" ON public.billing_renewal_links
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
);

CREATE POLICY "Billing reminders: read own" ON public.billing_subscription_reminders
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
);

CREATE POLICY "Billing reminders: admin write" ON public.billing_subscription_reminders
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
);

CREATE POLICY "Billing access logs: read own" ON public.billing_access_logs
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
);

CREATE POLICY "Billing access logs: admin write" ON public.billing_access_logs
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin'))
);
