-- ============================================================
-- tenant_payment_providers
-- Stocke les credentials de paiement par tenant (Stripe, PayPal).
-- Même pattern RLS que tenant_oauth_providers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_payment_providers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('stripe', 'paypal')),

  -- Clé publique / Client ID
  public_key      text,
  -- Clé secrète / Client Secret (sensible)
  secret_key      text,
  -- Secret de webhook (Stripe uniquement)
  webhook_secret  text,
  -- Mode d'environnement
  mode            text DEFAULT 'test' CHECK (mode IN ('test', 'live', 'sandbox', 'production')),

  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (tenant_id, provider)
);

-- Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS tenant_payment_providers_tenant_provider_idx
  ON public.tenant_payment_providers (tenant_id, provider);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.tenant_payment_providers ENABLE ROW LEVEL SECURITY;

-- Voir sa propre config (owner ou admin du tenant)
CREATE POLICY "tenant_payment_providers_select"
  ON public.tenant_payment_providers
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Créer sa config (owner ou admin)
CREATE POLICY "tenant_payment_providers_insert"
  ON public.tenant_payment_providers
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Modifier sa config (owner ou admin)
CREATE POLICY "tenant_payment_providers_update"
  ON public.tenant_payment_providers
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Supprimer sa config (owner ou admin)
CREATE POLICY "tenant_payment_providers_delete"
  ON public.tenant_payment_providers
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );
