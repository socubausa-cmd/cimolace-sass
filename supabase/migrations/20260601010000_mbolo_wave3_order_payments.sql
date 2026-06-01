-- ============================================================================
-- Mbolo — Vague paiement : suivi du paiement des commandes storefront
-- ----------------------------------------------------------------------------
-- ADDITIF, namespace mbolo_* uniquement. Ajoute le cycle de paiement sur
-- mbolo_orders (Stripe Checkout côté API Cimolace). Aucune table touchée hors
-- mbolo_orders. Appliqué via l'API management.
-- ============================================================================

begin;

alter table public.mbolo_orders add column if not exists payment_status text not null default 'unpaid';
alter table public.mbolo_orders add column if not exists payment_provider text;
alter table public.mbolo_orders add column if not exists payment_session_id text;
alter table public.mbolo_orders add column if not exists paid_at timestamptz;

create index if not exists idx_mbolo_orders_payment_session
  on public.mbolo_orders(payment_session_id) where payment_session_id is not null;

commit;
