-- ═══════════════════════════════════════════════════════════════════════════
-- RELIURE BILLING → CRM (tenant Cimolace).
-- Ferme le trou P0 de l'audit : le deal d'un tenant avait amount=0 codé en dur
-- et son étape dérivait de tenants.status, PAS d'un abonnement réel → MRR toujours 0.
-- Ici : le montant du deal = MRR RÉEL (billing_subscriptions × cycle du plan) et
-- l'étape suit le STATUT D'ABONNEMENT. Capté par trigger sur billing_subscriptions
-- → couvre TOUS les chemins de paiement (Stripe, PawaPay, renouvellement).
-- Appliqué hors-bande via psql (JAMAIS db push).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Liaison EXPLICITE société CRM ↔ tenant-client (robuste, sans matching par nom).
alter table public.crm_companies add column if not exists external_tenant_id uuid;
create index if not exists idx_crm_companies_ext_tenant
  on public.crm_companies(external_tenant_id) where external_tenant_id is not null;

-- 2) HELPER : applique l'abonnement courant d'un tenant sur SON deal CRM (MRR + étape [+ activité]).
create or replace function public.crm_apply_subscription_to_deal(
  p_tenant uuid, p_company uuid, p_log boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cim uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8';
  v_deal uuid;
  v_pipeline uuid;
  v_sub record;
  v_cycle text;
  v_mrr numeric := 0;
  v_cur text := 'EUR';
  v_stage uuid;
  v_status text := 'open';
begin
  if p_tenant is null or p_company is null then return; end if;

  select id, pipeline_id into v_deal, v_pipeline
    from public.crm_deals
    where tenant_id = v_cim and company_id = p_company
    order by created_at asc limit 1;
  if v_deal is null then return; end if;

  -- abonnement primaire : actif d'abord, puis le plus cher (le forfait principal),
  -- puis le plus récent. Un tenant peut cumuler plusieurs abos (add-ons) — on
  -- représente le principal sur le deal.
  select bs.status as status, bs.amount_cents as amount_cents, bs.currency as currency,
         bs.plan_id as plan_id, lower(coalesce(bp.billing_cycle,'monthly')) as cycle
    into v_sub
    from public.billing_subscriptions bs
    left join public.billing_plans bp on bp.key = bs.plan_id
    where bs.tenant_id = p_tenant
    order by (bs.status in ('active','trialing','past_due','unpaid')) desc,
             bs.amount_cents desc nulls last, bs.created_at desc
    limit 1;

  if v_sub.status is not null then
    v_cur := coalesce(v_sub.currency, 'EUR');
    v_cycle := coalesce(v_sub.cycle, 'monthly');
    -- unité majeure : XAF/XOF/… sans décimale ; sinon /100
    v_mrr := case when upper(v_cur) in ('XAF','XOF','XPF','JPY','KRW','CLP','VND','BIF','GNF','RWF','UGX')
                  then coalesce(v_sub.amount_cents,0)
                  else coalesce(v_sub.amount_cents,0) / 100.0 end;
    -- normalisation → mensuel (MRR)
    v_mrr := case v_cycle
               when 'yearly' then v_mrr / 12.0
               when 'quarterly' then v_mrr / 3.0
               when 'weekly' then v_mrr * 52.0 / 12.0
               when 'one_time' then 0
               when 'lifetime' then 0
               else v_mrr end;
    v_mrr := round(v_mrr);
  end if;

  -- étape cible selon le statut d'abonnement (sémantique SaaS) :
  --   client (Actif/gagné)   ← active / trialing / past_due / unpaid (impayé = client à RISQUE, pas prospect)
  --   perdu (Churn)          ← canceled / expired
  --   en cours (Onboarding)  ← pending / incomplete
  --   sans abo               ← Prospect (1re étape)
  if v_sub.status in ('active','trialing','past_due','unpaid') then
    select id into v_stage from public.crm_stages
      where tenant_id=v_cim and pipeline_id=v_pipeline and is_won=true order by position asc limit 1;
    v_status := 'won';
  elsif v_sub.status in ('canceled','cancelled','expired','incomplete_expired') then
    select id into v_stage from public.crm_stages
      where tenant_id=v_cim and pipeline_id=v_pipeline and is_lost=true order by position asc limit 1;
    v_status := 'lost';
  elsif v_sub.status in ('pending','incomplete') then
    select id into v_stage from public.crm_stages
      where tenant_id=v_cim and pipeline_id=v_pipeline and name ilike '%onboard%'
      order by position asc limit 1;
    v_status := 'open';
  end if;
  -- fallback : 1re étape non terminale
  if v_stage is null then
    select id into v_stage from public.crm_stages
      where tenant_id=v_cim and pipeline_id=v_pipeline
        and coalesce(is_won,false)=false and coalesce(is_lost,false)=false
      order by position asc limit 1;
  end if;

  update public.crm_deals set
    amount    = v_mrr,
    currency  = v_cur,
    stage_id  = coalesce(v_stage, stage_id),
    status    = v_status,
    closed_at = case when v_status in ('won','lost') then coalesce(closed_at, now()) else null end,
    updated_at = now()
  where id = v_deal;

  if p_log then
    insert into public.crm_activities (tenant_id, entity_type, entity_id, type, title, meta)
    values (v_cim, 'deal', v_deal, 'subscription_synced',
      case when v_sub.status is null then 'Aucun abonnement actif'
           when v_sub.status in ('past_due','unpaid') then '⚠️ Paiement en retard — ' || coalesce(v_sub.plan_id,'?')
                || ' · ' || v_mrr::text || ' ' || v_cur || '/mois (relance)'
           else 'Abonnement ' || coalesce(v_sub.plan_id,'?') || ' — ' || v_sub.status
                || ' · ' || v_mrr::text || ' ' || v_cur || '/mois' end,
      jsonb_build_object('mrr', v_mrr, 'currency', v_cur, 'sub_status', v_sub.status, 'plan', v_sub.plan_id));
  end if;
exception when others then
  return; -- reliure best-effort : ne casse jamais une écriture billing/tenant
end; $$;

-- 3) TRIGGER sur billing_subscriptions → répercute sur le deal CRM du tenant.
create or replace function public.crm_sync_subscription_to_deal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cim uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8';
  v_company uuid;
begin
  if NEW.tenant_id is null or NEW.tenant_id = v_cim then return NEW; end if;
  select id into v_company from public.crm_companies
    where tenant_id = v_cim and external_tenant_id = NEW.tenant_id limit 1;
  -- fallback : société liée par nom si external_tenant_id pas encore renseigné
  if v_company is null then
    select c.id into v_company from public.crm_companies c
      join public.tenants t on lower(t.name) = lower(c.name)
      where c.tenant_id = v_cim and t.id = NEW.tenant_id limit 1;
    if v_company is not null then
      update public.crm_companies set external_tenant_id = NEW.tenant_id where id = v_company;
    end if;
  end if;
  if v_company is not null then
    perform public.crm_apply_subscription_to_deal(NEW.tenant_id, v_company, true);
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_crm_sync_subscription on public.billing_subscriptions;
create trigger trg_crm_sync_subscription
  after insert or update of status, amount_cents, currency, plan_id, current_period_end
  on public.billing_subscriptions
  for each row execute function public.crm_sync_subscription_to_deal();

-- 4) La synchro tenant→CRM renseigne external_tenant_id ET applique l'abonnement
--    sur le deal (au lieu de dériver l'étape/le montant de tenants.status).
create or replace function public.crm_sync_tenant_to_cimolace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cim uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8';
  v_email text;
  v_name  text;
  v_first text;
  v_last  text;
  v_company uuid;
  v_contact uuid;
  v_pipeline uuid;
  v_stage uuid;
begin
  if coalesce(NEW.slug, '') = 'cimolace' then return NEW; end if;

  -- 1) SOCIÉTÉ = le tenant-client (find-or-create par nom), + liaison explicite.
  select id into v_company from public.crm_companies
    where tenant_id = v_cim and (external_tenant_id = NEW.id or lower(name) = lower(NEW.name)) limit 1;
  if v_company is null then
    insert into public.crm_companies (tenant_id, name, website, industry, description, external_tenant_id)
    values (v_cim, NEW.name, NEW.primary_domain, NEW.platform_type, 'Tenant Cimolace · ' || NEW.slug, NEW.id)
    returning id into v_company;
  else
    update public.crm_companies
      set website = coalesce(website, NEW.primary_domain),
          industry = coalesce(industry, NEW.platform_type),
          external_tenant_id = coalesce(external_tenant_id, NEW.id)
      where id = v_company;
  end if;

  -- 2) CONTACT = l'owner du tenant (résolu via profiles).
  if NEW.owner_user_id is not null then
    select nullif(btrim(lower(coalesce(email, ''))), ''), coalesce(full_name, name)
      into v_email, v_name from public.profiles where id = NEW.owner_user_id;
    if v_email is not null then
      select id into v_contact from public.crm_contacts
        where tenant_id = v_cim and lower(email) = v_email limit 1;
      if v_contact is null then
        v_first := nullif(split_part(coalesce(v_name, ''), ' ', 1), '');
        v_last  := nullif(btrim(substr(coalesce(v_name, ''), length(split_part(coalesce(v_name, ''), ' ', 1)) + 1)), '');
        insert into public.crm_contacts (tenant_id, company_id, user_id, first_name, last_name, email, source, status)
        values (v_cim, v_company, NEW.owner_user_id, v_first, v_last, v_email, 'tenant', 'active')
        on conflict do nothing
        returning id into v_contact;
        if v_contact is null then
          select id into v_contact from public.crm_contacts where tenant_id = v_cim and lower(email) = v_email limit 1;
        end if;
      else
        update public.crm_contacts
          set company_id = coalesce(company_id, v_company), user_id = coalesce(user_id, NEW.owner_user_id)
          where id = v_contact;
      end if;
    end if;
  end if;

  -- 3) DEAL = le client dans le pipeline (find-or-create par société).
  select id into v_pipeline from public.crm_pipelines
    where tenant_id = v_cim order by is_default desc, position asc limit 1;
  if v_pipeline is not null
     and not exists (select 1 from public.crm_deals where tenant_id = v_cim and company_id = v_company) then
    select id into v_stage from public.crm_stages
      where tenant_id = v_cim and pipeline_id = v_pipeline order by position asc limit 1;
    insert into public.crm_deals (tenant_id, pipeline_id, stage_id, company_id, contact_id, title, amount, currency, status)
    values (v_cim, v_pipeline, v_stage, v_company, v_contact, NEW.name, 0, 'EUR', 'open');
  end if;

  -- 4) Reliure billing : (ré)aligne le deal sur l'abonnement réel (MRR + étape).
  perform public.crm_apply_subscription_to_deal(NEW.id, v_company, false);

  return NEW;
exception when others then
  return NEW;
end;
$$;

-- 5) BACKFILL : lier les sociétés existantes à leur tenant + aligner les deals sur l'abonnement.
update public.crm_companies c
  set external_tenant_id = t.id
  from public.tenants t
  where c.tenant_id = '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8'
    and c.external_tenant_id is null
    and lower(t.name) = lower(c.name)
    and t.slug <> 'cimolace';

do $$
declare r record;
begin
  for r in
    select id, external_tenant_id from public.crm_companies
    where tenant_id = '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8' and external_tenant_id is not null
  loop
    perform public.crm_apply_subscription_to_deal(r.external_tenant_id, r.id, false);
  end loop;
end $$;
