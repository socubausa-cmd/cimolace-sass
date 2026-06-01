-- ═══════════════════════════════════════════════════════════════
-- SaaS core (LOT A→B→C) — resolver hôte, comptes paiement, isolation Live
-- ═══════════════════════════════════════════════════════════════
-- • cimolace_tenants.slug (colonne dédiée, sync depuis metadata.slug)
-- • tenant_host_bindings : résolution Host → tenant_id
-- • payment_providers + tenant_payment_accounts (config JSONB, chiffrement app ultérieur)
-- • live_sessions.cimolace_tenant_id, billing_* .cimolace_tenant_id + index
-- RLS : activé sur les nouvelles tables ; accès via service_role (bypass) uniquement côté API.

-- ─── 1) Slug sur cimolace_tenants ───────────────────────────────────────────
ALTER TABLE public.cimolace_tenants
  ADD COLUMN IF NOT EXISTS slug VARCHAR(120);

UPDATE public.cimolace_tenants t
SET slug = lower(regexp_replace(trim(t.metadata->>'slug'), '[^a-z0-9-]+', '-', 'g'))
WHERE (t.slug IS NULL OR trim(t.slug) = '')
  AND t.metadata ? 'slug'
  AND trim(t.metadata->>'slug') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cimolace_tenants_slug_lower
  ON public.cimolace_tenants (lower(trim(slug)))
  WHERE slug IS NOT NULL AND trim(slug) <> '';

COMMENT ON COLUMN public.cimolace_tenants.slug IS
  'Identifiant URL stable du tenant (résolution modules / billing). Sync avec metadata.slug si besoin.';

-- ─── 2) Liaisons hostname → tenant ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_host_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.cimolace_tenants(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_host_bindings_hostname_nonempty CHECK (length(trim(hostname)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_host_bindings_hostname_lower
  ON public.tenant_host_bindings (lower(trim(hostname)));

CREATE INDEX IF NOT EXISTS idx_tenant_host_bindings_tenant_id
  ON public.tenant_host_bindings(tenant_id);

COMMENT ON TABLE public.tenant_host_bindings IS
  'Résolution runtime : Host HTTP → tenant_id (apex, sous-domaine, domaine custom).';

-- Seed minimal : ISNA (ajouter d’autres hosts via dashboard / migration ultérieure)
INSERT INTO public.tenant_host_bindings (tenant_id, hostname)
SELECT t.id, v.host
FROM public.cimolace_tenants t
CROSS JOIN (VALUES
  ('isna.pro'),
  ('www.isna.pro'),
  ('isna.prorascience.org')
) AS v(host)
WHERE lower(trim(t.slug)) = 'isna'
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_host_bindings b
    WHERE b.tenant_id = t.id AND lower(trim(b.hostname)) = lower(trim(v.host))
  );

-- ─── 3) Catalogue fournisseurs de paiement ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_providers_code_lower
  ON public.payment_providers (lower(trim(code)));

COMMENT ON TABLE public.payment_providers IS
  'Catalogue universel (stripe, chariow, …). Pas de secrets ici.';

INSERT INTO public.payment_providers (code, display_name)
SELECT v.code, v.display_name
FROM (VALUES
  ('stripe', 'Stripe'),
  ('chariow', 'Chariow'),
  ('cinetpay', 'CinetPay'),
  ('nowpayments', 'NOWPayments')
) AS v(code, display_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_providers p
  WHERE lower(trim(p.code)) = lower(trim(v.code))
);

-- ─── 4) Comptes paiement par tenant ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.cimolace_tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.payment_providers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'pending')),
  -- Secrets : chiffrer côté app / vault ; accès service_role uniquement.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_credentials TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_payment_accounts_tenant_provider UNIQUE (tenant_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_accounts_tenant
  ON public.tenant_payment_accounts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_accounts_provider
  ON public.tenant_payment_accounts(provider_id);

DO $$ BEGIN
  CREATE TRIGGER trg_tenant_payment_accounts_updated_at
  BEFORE UPDATE ON public.tenant_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;

COMMENT ON TABLE public.tenant_payment_accounts IS
  'Instance paiement par tenant (webhook_secret, clés API refs). Dashboard-only ; jamais exposé au client.';

-- ─── 5) Colonnes tenant sur live + billing ─────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS cimolace_tenant_id UUID REFERENCES public.cimolace_tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_cimolace_tenant_id
  ON public.live_sessions(cimolace_tenant_id);

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS cimolace_tenant_id UUID REFERENCES public.cimolace_tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_cimolace_tenant_id
  ON public.billing_subscriptions(cimolace_tenant_id);

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS cimolace_tenant_id UUID REFERENCES public.cimolace_tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payments_cimolace_tenant_id
  ON public.billing_payments(cimolace_tenant_id);

-- Backfill : rattacher au tenant slug isna (ou premier tenant actif)
DO $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT id INTO v_tenant
  FROM public.cimolace_tenants
  WHERE lower(trim(slug)) = 'isna'
  LIMIT 1;

  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant
    FROM public.cimolace_tenants
    WHERE status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_tenant IS NULL THEN
    RAISE NOTICE 'saas_core: aucun cimolace_tenants — pas de backfill tenant_id';
    RETURN;
  END IF;

  UPDATE public.live_sessions
  SET cimolace_tenant_id = v_tenant
  WHERE cimolace_tenant_id IS NULL;

  UPDATE public.billing_subscriptions
  SET cimolace_tenant_id = v_tenant
  WHERE cimolace_tenant_id IS NULL;

  UPDATE public.billing_payments
  SET cimolace_tenant_id = v_tenant
  WHERE cimolace_tenant_id IS NULL;
END $$;

-- ─── 6) RLS (minimal : pas de policies JWT ; service_role bypass) ───────────
ALTER TABLE public.tenant_host_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_payment_accounts ENABLE ROW LEVEL SECURITY;
