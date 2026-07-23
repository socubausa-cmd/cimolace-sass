-- ═════════════════════════════════════════════════════════════════════════════
-- COCKPIT DE COÛT FONDATEUR — vue consolidée « consommation & risque » par tenant.
--
-- But (obsession fondateur « ne pas me ruiner ») : voir d'un coup, par tenant,
-- ce qui consomme de l'infra payante — crédits IA + minutes live + dépassement en
-- cours d'accumulation + dépassement à facturer — pour repérer les clients coûteux
-- AVANT la facture. 100 % lecture, aucun effet sur les clients.
--
-- Sources : ai_credit_balances (IA + overage), tenant_usage_monthly (minutes live),
-- billing_subscriptions→billing_plans (quotas inclus du plan actif), ai_overage_pending.
-- Appliqué hors-bande via psql (jamais db push).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view founder_tenant_cost_overview as
with active_sub as (
  -- 1 abonnement actif par tenant (le plus récent actif/trialing)
  select distinct on (s.tenant_id)
         s.tenant_id, s.plan_id, s.status,
         p.key as plan_key, p.label as plan_name,
         coalesce((p.metadata->'quotas'->>'live_minutes')::numeric, 0)  as live_included,
         coalesce((p.metadata->'quotas'->>'ai_credits')::numeric, 0)    as ai_included_plan
  from billing_subscriptions s
  left join billing_plans p on p.key = s.plan_id
  where s.status in ('active','trialing','past_due')
  order by s.tenant_id, s.created_at desc nulls last
),
live_used as (
  select tenant_id, coalesce(used,0) as live_used, coalesce(extra,0) as live_extra
  from tenant_usage_monthly
  where metric = 'live_minutes' and period = date_trunc('month', now())::date
),
overage_pending as (
  select tenant_id, coalesce(sum(amount_eur),0) as pending_eur, count(*) as pending_invoices
  from ai_overage_invoices where status = 'pending' group by tenant_id
)
select
  t.id                                              as tenant_id,
  t.name                                            as tenant_name,
  t.slug                                            as tenant_slug,
  asub.plan_key,
  asub.plan_name,
  b.plan_tier                                       as ai_plan_tier,
  -- IA
  coalesce(b.monthly_quota, 0)                      as ai_included,
  coalesce(b.balance_credits, 0)                    as ai_balance,
  greatest(0, coalesce(b.monthly_quota,0) - coalesce(b.balance_credits,0)) as ai_consumed,
  case when coalesce(b.monthly_quota,0) > 0
       then round(greatest(0, b.monthly_quota - b.balance_credits) / b.monthly_quota * 100, 1)
       else 0 end                                   as ai_pct_used,
  coalesce(b.total_consumed, 0)                     as ai_consumed_lifetime,
  -- Dépassement IA
  coalesce(b.overage_enabled, false)                as overage_enabled,
  coalesce(b.overage_credits, 0)                    as overage_credits,
  round(coalesce(b.overage_credits,0) * public.ai_overage_price(b.plan_tier), 2) as overage_accruing_eur,
  coalesce(b.overage_cap_eur, 0)                    as overage_cap_eur,
  coalesce(op.pending_eur, 0)                       as overage_pending_eur,
  coalesce(op.pending_invoices, 0)                  as overage_pending_invoices,
  -- Minutes live (0 tant que LiveKit Ship pas actif)
  coalesce(asub.live_included, 0)                   as live_included,
  coalesce(lu.live_used, 0)                         as live_used,
  coalesce(lu.live_extra, 0)                        as live_extra,
  case when coalesce(asub.live_included,0) > 0
       then round(coalesce(lu.live_used,0) / asub.live_included * 100, 1)
       else 0 end                                   as live_pct_used,
  -- Drapeaux de risque
  (coalesce(b.monthly_quota,0) > 0
     and greatest(0, b.monthly_quota - b.balance_credits) >= b.monthly_quota * 0.8) as ai_at_risk,
  (coalesce(asub.live_included,0) > 0
     and coalesce(lu.live_used,0) >= asub.live_included * 0.8)                      as live_at_risk,
  (coalesce(b.overage_credits,0) > 0 or coalesce(op.pending_eur,0) > 0)             as overage_active,
  b.is_blocked                                      as ai_blocked
from tenants t
left join ai_credit_balances b on b.tenant_id = t.id
left join active_sub asub       on asub.tenant_id = t.id
left join live_used lu          on lu.tenant_id = t.id
left join overage_pending op    on op.tenant_id = t.id
-- ne garder que les tenants avec une réalité de conso ou un abo (évite le bruit)
where b.tenant_id is not null or asub.tenant_id is not null
order by overage_pending_eur desc, overage_accruing_eur desc, ai_pct_used desc;

comment on view founder_tenant_cost_overview is
  'Cockpit fondateur : conso IA + minutes live + dépassement (accumulé/à facturer) + risque par tenant.';
