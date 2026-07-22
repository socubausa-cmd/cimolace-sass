-- Le client peut désormais choisir son CYCLE au checkout (mensuel/trimestriel −10 %/annuel −20 %).
-- Le cycle choisi est mémorisé dans billing_subscriptions.metadata.cycle_override et
-- amount_cents devient le TOTAL du cycle. Le normaliseur MRR du CRM doit donc préférer
-- ce cycle au billing_cycle du plan (sinon un annuel 2880 € compterait 2880 €/mois).
-- Appliqué hors-bande via psql (JAMAIS db push).

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

  -- abonnement primaire : actif d'abord, puis le plus cher, puis le plus récent.
  -- CYCLE : metadata.cycle_override (choix client au checkout) prime sur le plan.
  select bs.status as status, bs.amount_cents as amount_cents, bs.currency as currency,
         bs.plan_id as plan_id,
         lower(coalesce(bs.metadata->>'cycle_override', bp.billing_cycle, 'monthly')) as cycle
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
    v_mrr := case when upper(v_cur) in ('XAF','XOF','XPF','JPY','KRW','CLP','VND','BIF','GNF','RWF','UGX')
                  then coalesce(v_sub.amount_cents,0)
                  else coalesce(v_sub.amount_cents,0) / 100.0 end;
    v_mrr := case v_cycle
               when 'yearly' then v_mrr / 12.0
               when 'quarterly' then v_mrr / 3.0
               when 'weekly' then v_mrr * 52.0 / 12.0
               when 'one_time' then 0
               when 'lifetime' then 0
               else v_mrr end;
    v_mrr := round(v_mrr);
  end if;

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
      jsonb_build_object('mrr', v_mrr, 'currency', v_cur, 'sub_status', v_sub.status,
                         'plan', v_sub.plan_id, 'cycle', v_sub.cycle));
  end if;
exception when others then
  return;
end; $$;
