-- ─────────────────────────────────────────────────────────────────────────────
-- mbolo_accounting_settings : entité légale / config comptable PAR TENANT.
--
-- Corrige la fuite « 1 seule entité » (getAccountingSettings prenait la 1re ligne
-- = un seul SIREN « Zahir Wellness » pour toutes les boutiques). Ici UNIQUE(tenant_id)
-- = exactement une entité légale par tenant. La config (raison sociale, SIREN,
-- journaux, comptes PCG, options FEC) vit dans `config` JSONB. La FEC/orders/factures
-- sont déjà tenant-scopées via les ponts (listOrders/listInvoices → API). Vague 3.
-- Appliqué HORS-BANDE via psql.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mbolo_accounting_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mbolo_accounting_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mbolo_accounting_settings' AND policyname='mbolo_accounting_settings_service_all') THEN
    CREATE POLICY mbolo_accounting_settings_service_all ON public.mbolo_accounting_settings
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.mbolo_accounting_settings IS 'Entité légale + config comptable par tenant (Vague 3). UNIQUE(tenant_id).';
