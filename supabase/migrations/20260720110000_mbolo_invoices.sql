-- ─────────────────────────────────────────────────────────────────────────────
-- mbolo_invoices : facturation TENANT-SCOPÉE.
--
-- Chaque boutique émet ses propres factures ; numérotation UNIQUE PAR TENANT
-- (INV-YYYY-NNNN), jamais globale (évite les collisions inter-boutiques que
-- l'audit signalait). Lignes en JSONB ; champs riches storefront préservés dans
-- `metadata`. Consolidation sur l'API Cimolace (Vague 3). Appliqué via psql.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mbolo_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number   text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','void','overdue')),
  customer_name    text,
  customer_email   text,
  customer_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency         text NOT NULL DEFAULT 'XAF',
  subtotal_cents   integer NOT NULL DEFAULT 0,
  tax_cents        integer NOT NULL DEFAULT 0,
  total_cents      integer NOT NULL DEFAULT 0,
  lines            jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes            text,
  order_id         uuid,
  issued_at        timestamptz,
  due_at           timestamptz,
  paid_at          timestamptz,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_mbolo_invoices_tenant ON public.mbolo_invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mbolo_invoices_status ON public.mbolo_invoices (tenant_id, status);

ALTER TABLE public.mbolo_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mbolo_invoices' AND policyname='mbolo_invoices_service_all') THEN
    CREATE POLICY mbolo_invoices_service_all ON public.mbolo_invoices
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.mbolo_invoices IS 'Factures par tenant (Vague 3). invoice_number UNIQUE par tenant ; lines/metadata JSONB.';
