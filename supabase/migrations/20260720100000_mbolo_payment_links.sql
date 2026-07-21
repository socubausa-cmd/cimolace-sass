-- ─────────────────────────────────────────────────────────────────────────────
-- mbolo_payment_links : liens de paiement / facturation TENANT-SCOPÉS.
--
-- Chaque boutique (tenant) crée ses propres liens de paiement ; le client paie
-- via le compte Stripe DU TENANT (résolu par tenant_payment_providers, repli
-- plateforme). Le lien public se résout par `token` (unique global) — le tenant
-- se dérive de la ligne. Les champs riches du storefront (échéancier, remise,
-- livraison) sont préservés dans `metadata` (JSONB) sans perte.
--
-- Consolidation sur l'API Cimolace (Vague 2). Appliqué HORS-BANDE via psql.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mbolo_payment_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token             text NOT NULL UNIQUE,
  title             text NOT NULL,
  description       text,
  amount_cents      integer NOT NULL CHECK (amount_cents >= 0),
  currency          text NOT NULL DEFAULT 'XAF',
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paid','expired','cancelled')),
  customer_email    text,
  customer_name     text,
  order_id          uuid,
  payment_provider  text,
  payment_session_id text,
  paid_at           timestamptz,
  expires_at        timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbolo_payment_links_tenant  ON public.mbolo_payment_links (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mbolo_payment_links_status  ON public.mbolo_payment_links (tenant_id, status);

-- RLS : filet pour l'accès anon/authenticated ; le moteur (service_role) filtre
-- déjà tenant_id en dur (ApiKeyGuard résout le tenant depuis la clé).
ALTER TABLE public.mbolo_payment_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mbolo_payment_links' AND policyname='mbolo_payment_links_service_all') THEN
    CREATE POLICY mbolo_payment_links_service_all ON public.mbolo_payment_links
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.mbolo_payment_links IS 'Liens de paiement/facturation par tenant (Vague 2). token = lookup public; metadata = champs riches storefront.';
