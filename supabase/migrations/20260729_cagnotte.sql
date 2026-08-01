-- Cagnotte publique (dons anonymes) — smartphone pour filmer les cultes/enregistrements.
-- Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

create table if not exists public.cagnotte_campaigns (
  slug          text primary key,
  title         text not null,
  device_name   text not null,
  goal_cents    integer not null check (goal_cents > 0),   -- en centimes EUR (devise de référence)
  currency      text not null default 'EUR',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.cagnotte_donations (
  id               uuid primary key default gen_random_uuid(),
  campaign_slug    text not null references public.cagnotte_campaigns(slug) on delete cascade,
  provider         text not null check (provider in ('stripe','pawapay')),
  amount_cents     integer not null check (amount_cents >= 0),  -- normalisé en centimes EUR (pour le total)
  display_amount   numeric,                                     -- montant réellement débité (ex: 65596 XAF)
  display_currency text,                                        -- 'EUR' | 'XAF' | 'XOF'
  status           text not null default 'pending' check (status in ('pending','completed','failed')),
  provider_ref     text,                                        -- stripe session id / pawapay depositId
  donor_name       text,
  donor_message    text,
  country          text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists idx_cagnotte_donations_campaign_status
  on public.cagnotte_donations(campaign_slug, status);
create unique index if not exists uq_cagnotte_donations_provider_ref
  on public.cagnotte_donations(provider, provider_ref) where provider_ref is not null;

-- RLS activée SANS policy anonyme : aucune lecture/écriture directe depuis le front.
-- Tout passe par l'API (service_role bypass RLS) : la campagne + le total agrégé
-- sont servis par un endpoint public, les dons ne sont écrits que côté serveur.
alter table public.cagnotte_campaigns enable row level security;
alter table public.cagnotte_donations enable row level security;

insert into public.cagnotte_campaigns (slug, title, device_name, goal_cents, currency)
values (
  'smartforme-culte',
  'Un smartphone pour filmer les cultes',
  'Samsung Galaxy S26 Ultra — 1 To',
  170000,
  'EUR'
)
on conflict (slug) do update
  set title = excluded.title,
      device_name = excluded.device_name,
      goal_cents = excluded.goal_cents,
      updated_at = now();

-- Offre post-don : séance de prière gratuite (RDV) en remerciement de l'offrande.
alter table public.cagnotte_campaigns add column if not exists booking_url text;
alter table public.cagnotte_campaigns add column if not exists booking_label text;
update public.cagnotte_campaigns
  set booking_url = coalesce(booking_url, '/temple-ngowazulu'),
      booking_label = coalesce(booking_label, 'Réserver une séance de prière gratuite')
  where slug = 'smartforme-culte';
