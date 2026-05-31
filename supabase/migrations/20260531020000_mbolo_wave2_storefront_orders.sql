-- ============================================================================
-- Mbolo — Vague 2 : commandes storefront (checkout invité via clé API)
-- ----------------------------------------------------------------------------
-- ADDITIF / non destructif, namespace mbolo_* uniquement.
--   • mbolo_orders.user_id : NOT NULL -> NULL (commande invité sans compte)
--   • colonnes client invité + canal + adresse + devise + n° de commande
--   • mbolo_order_items : variant_id + snapshot nom produit
-- Ne touche AUCUNE table hors mbolo_*. Appliqué via l'API management.
-- ============================================================================

begin;

-- ─── mbolo_orders : autoriser les commandes invité (sans compte Cimolace) ────
alter table public.mbolo_orders alter column user_id drop not null;

alter table public.mbolo_orders add column if not exists order_number text;
alter table public.mbolo_orders add column if not exists customer_email text;
alter table public.mbolo_orders add column if not exists customer_name text;
alter table public.mbolo_orders add column if not exists customer_phone text;
alter table public.mbolo_orders add column if not exists shipping_address jsonb not null default '{}'::jsonb;
alter table public.mbolo_orders add column if not exists currency text not null default 'XAF';
alter table public.mbolo_orders add column if not exists channel text not null default 'app';
alter table public.mbolo_orders add column if not exists updated_at timestamptz not null default now();

create unique index if not exists mbolo_orders_tenant_number_key
  on public.mbolo_orders(tenant_id, order_number) where order_number is not null;

-- ─── mbolo_order_items : variante choisie + snapshot nom ─────────────────────
alter table public.mbolo_order_items add column if not exists variant_id uuid
  references public.mbolo_product_variants(id) on delete set null;
alter table public.mbolo_order_items add column if not exists product_name text;

commit;
