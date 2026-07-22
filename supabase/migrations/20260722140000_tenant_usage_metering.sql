-- ═══════════════════════════════════════════════════════════════════════════
-- COMPTEUR D'USAGE PAR TENANT — minutes live (LiveKit) + crédits IA (LLM).
-- Politique économique : chaque palier inclut un quota mensuel ; au-delà, le
-- tenant achète des PACKS de crédits vendus ~10× le coût infra (la majoration
-- finance la plateforme). Le non-consommé EXPIRE en fin de mois (inclus ET
-- packs → le propriétaire récupère les minutes restantes). Jamais de coupure
-- d'un live en cours : le quota bloque uniquement le DÉMARRAGE.
-- Appliqué hors-bande via psql (JAMAIS db push).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Agrégat mensuel (source de vérité du gating — lecture rapide)
create table if not exists public.tenant_usage_monthly (
  tenant_id uuid not null,
  metric text not null check (metric in ('live_minutes','ai_credits')),
  period date not null,               -- 1er jour du mois (UTC)
  used numeric not null default 0,
  extra numeric not null default 0,   -- crédits achetés, valables CE mois uniquement
  updated_at timestamptz not null default now(),
  primary key (tenant_id, metric, period)
);

-- 2) Registre append-only (audit, litiges, debug)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  metric text not null,
  amount numeric not null,
  source text,                        -- 'livekit:participant_left' | 'ai:soap' | 'pack:pack-live-1000'…
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_events_tenant
  on public.usage_events(tenant_id, metric, created_at desc);

-- RLS deny-by-default (accès service_role via l'API uniquement, comme crm_*)
alter table public.tenant_usage_monthly enable row level security;
alter table public.usage_events enable row level security;

-- 3) RPC atomique : CONSOMMER (webhook LiveKit / requête IA)
create or replace function public.usage_consume(
  p_tenant uuid, p_metric text, p_amount numeric,
  p_source text default null, p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tenant is null or p_amount is null or p_amount <= 0 then return; end if;
  insert into public.usage_events (tenant_id, metric, amount, source, meta)
  values (p_tenant, p_metric, p_amount, p_source, coalesce(p_meta, '{}'::jsonb));
  insert into public.tenant_usage_monthly as t (tenant_id, metric, period, used)
  values (p_tenant, p_metric, date_trunc('month', now())::date, p_amount)
  on conflict (tenant_id, metric, period)
  do update set used = t.used + excluded.used, updated_at = now();
exception when others then
  return; -- le comptage ne casse JAMAIS l'opération métier
end; $$;

-- 4) RPC atomique : CRÉDITER (achat de pack — période COURANTE, expire fin de mois)
create or replace function public.usage_add_credits(
  p_tenant uuid, p_metric text, p_amount numeric, p_source text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tenant is null or p_amount is null or p_amount <= 0 then return; end if;
  insert into public.usage_events (tenant_id, metric, amount, source, meta)
  values (p_tenant, p_metric, -p_amount, p_source, jsonb_build_object('kind','credit'));
  insert into public.tenant_usage_monthly as t (tenant_id, metric, period, extra)
  values (p_tenant, p_metric, date_trunc('month', now())::date, p_amount)
  on conflict (tenant_id, metric, period)
  do update set extra = t.extra + excluded.extra, updated_at = now();
end; $$;

-- 5) QUOTAS INCLUS par plan (billing_plans.metadata.quotas) — grille validée :
--    entrée 2 000 min / milieu 6 000 / haut 20 000 ; IA proportionnel.
update public.billing_plans set metadata = coalesce(metadata,'{}'::jsonb)
  || jsonb_build_object('quotas', jsonb_build_object('live_minutes', q.lm, 'ai_credits', q.ai))
from (values
  ('cimolace-medos-sprout',      500,   25),
  ('cimolace-medos-solo',       2000,  100),
  ('cimolace-medos-pro',        6000,  200),
  ('cimolace-medos-clinic',    20000,  500),
  ('cimolace-bienetre-starter', 2000,  100),
  ('cimolace-bienetre-pro',     6000,  200),
  ('cimolace-createur-starter', 2000,  100),
  ('cimolace-createur-pro',     6000,  300),
  ('cimolace-createur-business',20000, 800),
  ('cimolace-ecole-starter',    6000,  200),
  ('cimolace-ecole-pro',       20000,  500),
  ('cimolace-ecole-business',  40000, 1000),
  ('zahir-forfait',            20000,  500)
) as q(key, lm, ai)
where billing_plans.key = q.key;

-- 6) PACKS DE CRÉDITS (one-time, majoration ~10× le coût infra ; coût LiveKit
--    ≈ 0,00046 €/min → vendu 0,004-0,005 €/min ; IA ≈ 0,001-0,01 €/req → 0,04-0,05 €/req)
insert into public.billing_plans (key, label, description, price_cents, currency, billing_cycle, category, is_active, metadata)
values
  ('pack-live-1000',  'Pack Live 1 000 min',  '1 000 minutes-participant de live, valables le mois en cours', 500,  'EUR', 'one_time', 'credits', true,
    '{"credit_metric":"live_minutes","credit_amount":1000,"price_xaf":3000,"price_xaf_currency":"XAF"}'::jsonb),
  ('pack-live-5000',  'Pack Live 5 000 min',  '5 000 minutes-participant de live, valables le mois en cours', 2000, 'EUR', 'one_time', 'credits', true,
    '{"credit_metric":"live_minutes","credit_amount":5000,"price_xaf":12000,"price_xaf_currency":"XAF"}'::jsonb),
  ('pack-live-20000', 'Pack Live 20 000 min', '20 000 minutes-participant de live, valables le mois en cours', 6000, 'EUR', 'one_time', 'credits', true,
    '{"credit_metric":"live_minutes","credit_amount":20000,"price_xaf":36000,"price_xaf_currency":"XAF"}'::jsonb),
  ('pack-ai-100',     'Pack IA 100 crédits',  '100 requêtes IA (scribe, agents, génération), valables le mois en cours', 500,  'EUR', 'one_time', 'credits', true,
    '{"credit_metric":"ai_credits","credit_amount":100,"price_xaf":3000,"price_xaf_currency":"XAF"}'::jsonb),
  ('pack-ai-500',     'Pack IA 500 crédits',  '500 requêtes IA, valables le mois en cours', 2000, 'EUR', 'one_time', 'credits', true,
    '{"credit_metric":"ai_credits","credit_amount":500,"price_xaf":12000,"price_xaf_currency":"XAF"}'::jsonb)
on conflict (key) do update set
  label = excluded.label, description = excluded.description,
  price_cents = excluded.price_cents, metadata = excluded.metadata, is_active = true;
