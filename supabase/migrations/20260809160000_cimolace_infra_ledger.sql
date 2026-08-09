-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRE D'INFRASTRUCTURE ET DÉPENSES — console propriétaire Cimolace.
--
-- Le fondateur ne savait nulle part ce que la plateforme lui coûte : les coûts
-- IA par tenant existaient (founder_tenant_cost_overview), mais l'hébergement,
-- la base, le média, l'e-mail et le paiement n'étaient inscrits QUE dans les
-- factures des fournisseurs, chacune dans sa boîte mail.
--
-- Deux tables, deux questions distinctes :
--   cimolace_infra_services  → « à quoi suis-je abonné, et est-ce que ça tourne ? »
--   cimolace_infra_expenses  → « qu'ai-je réellement payé, et quand ? »
--
-- ⚠️ Le montant récurrent d'un service est un ENGAGEMENT (ce que je dois chaque
-- mois) ; une dépense est un FAIT DATÉ. Les confondre dans une seule colonne
-- empêcherait de voir l'écart entre le prévu et le payé — l'écart est justement
-- l'information utile.
--
-- 100 % ADDITIF. RLS activée SANS politique = service_role uniquement, même
-- posture que billing_payouts : ces lignes ne sortent que par l'API gardée.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cimolace_infra_services (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  label         text not null,
  -- hebergement | base | media | ia | paiement | communication | outil
  category      text not null default 'outil',
  plan          text,
  -- Montant de l'engagement récurrent. Unité MAJEURE pour les devises sans
  -- décimale (XAF), centimes sinon — même convention que billing_payouts.
  amount_cents  integer not null default 0,
  currency      text not null default 'EUR',
  -- mensuel | annuel | usage (facturé à la consommation) | gratuit
  cycle         text not null default 'mensuel',
  -- actif | essai | suspendu | resilie
  statut        text not null default 'actif',
  renews_on     date,
  -- Sonde HTTP : c'est ce qui répond à « est-ce que ça fonctionne ? ».
  health_url    text,
  console_url   text,
  account_email text,
  -- Sans ce service, la plateforme s'arrête-t-elle ? Sert à trier l'urgence.
  is_critical   boolean not null default false,
  notes         text,
  sort          integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.cimolace_infra_expenses (
  id           uuid primary key default gen_random_uuid(),
  service_key  text not null references public.cimolace_infra_services(key) on update cascade on delete cascade,
  -- Toujours le 1er du mois concerné : une dépense appartient à une période,
  -- pas à sa date de prélèvement (qui varie d'un fournisseur à l'autre).
  period       date not null,
  amount_cents integer not null,
  currency     text not null default 'EUR',
  -- manuel | api  — dire d'où vient le chiffre, sinon on ne sait plus lequel croire.
  source       text not null default 'manuel',
  invoice_url  text,
  note         text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

-- Un seul montant par service et par mois : ressaisir la même facture ne doit
-- pas doubler la dépense du mois.
create unique index if not exists cimolace_infra_expenses_uniq
  on public.cimolace_infra_expenses (service_key, period);
create index if not exists cimolace_infra_expenses_period_idx
  on public.cimolace_infra_expenses (period desc);

alter table public.cimolace_infra_services enable row level security;
alter table public.cimolace_infra_expenses enable row level security;

comment on table public.cimolace_infra_services is
  'Registre des fournisseurs d''infrastructure Cimolace : engagement récurrent, criticité, sonde de santé. Lecture/écriture par l''API staff uniquement (RLS sans politique).';
comment on table public.cimolace_infra_expenses is
  'Dépense RÉELLE constatée par service et par mois. Distincte de l''engagement porté par cimolace_infra_services.amount_cents.';
