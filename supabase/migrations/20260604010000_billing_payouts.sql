-- ============================================================================
-- Retraits / versements mobile money (payouts PawaPay) — additif
-- ----------------------------------------------------------------------------
-- Trace les versements sortants (plateforme → mobile money d'un bénéficiaire :
-- marchand Mbolo, remboursement, reversement…). Aucune table existante touchée.
-- ============================================================================

begin;

create table if not exists public.billing_payouts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  payout_id       text not null,                 -- UUID envoyé à PawaPay (idempotence)
  provider        text not null default 'pawapay',
  status          text not null default 'pending',-- pending|accepted|completed|failed|rejected
  amount_cents    integer not null,
  currency        text not null default 'XAF',
  phone_number    text not null,
  mno             text not null,                 -- opérateur PawaPay (ex: MTN_MOMO_CMR)
  recipient_name  text,
  reason          text,
  provider_tx_id  text,
  failure_code    text,
  failure_message text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (payout_id)
);

create index if not exists idx_billing_payouts_tenant on public.billing_payouts(tenant_id, created_at desc);

commit;
