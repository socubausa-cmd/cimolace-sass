-- ═════════════════════════════════════════════════════════════════════════════
-- AI BILLING — Facturation « metered » du DÉPASSEMENT (overage postpaid)
--
-- Modèle Cursor : quand le quota IA mensuel est épuisé, un tenant qui a OPTÉ peut
-- continuer à consommer au-delà (overage). Ce dépassement est facturé À LA FIN DU
-- MOIS, au crédit (postpaid).
--
-- Garde-fous (décision fondateur) :
--   • opt-in PAR TENANT — défaut OFF = fail-closed → 402 quand le quota est fini
--     (indispensable pour le marché Afrique : on ne laisse pas filer de dette) ;
--   • plafond anti-surprise en EUR (défaut 50 €) : au-delà → 402 OVERAGE_CAP_REACHED ;
--   • le règlement crée une FACTURE (status=pending) — AUCUN prélèvement automatique.
--     La finalisation Stripe/PawaPay reste une action fondateur (draft → revue → envoi).
--
-- Source de vérité de facturation = ai_credit_balances.overage_credits (accumulateur),
-- indépendant du signe du solde. Appliqué HORS-BANDE via psql (jamais db push).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1) Prix du dépassement par plan (EUR/crédit). NULL → défaut global 0,02 € ──
--     (le pack le moins cher = 0,015 €/cr ; overage = léger premium pour inciter au prépayé)
alter table public.ai_plan_quotas
  add column if not exists overage_price_eur numeric(10,4);

update public.ai_plan_quotas
  set overage_price_eur = 0.02
  where plan_tier in ('pro', 'business') and overage_price_eur is null;

-- ─── 2) Accounting du dépassement sur le solde tenant ───────────────────────────
alter table public.ai_credit_balances
  add column if not exists overage_enabled  boolean       not null default false,
  add column if not exists overage_credits  numeric(18,4) not null default 0,
  add column if not exists overage_cap_eur  numeric(10,2) not null default 50;

comment on column public.ai_credit_balances.overage_enabled is
  'Opt-in dépassement à l''usage. Défaut FALSE = fail-closed (402 quand quota fini).';
comment on column public.ai_credit_balances.overage_credits is
  'Crédits consommés en dépassement, non encore réglés. Source de vérité de facturation.';
comment on column public.ai_credit_balances.overage_cap_eur is
  'Plafond anti-surprise du dépassement mensuel en EUR. Au-delà → 402.';

-- ─── 3) Factures de dépassement (postpaid) ──────────────────────────────────────
create table if not exists public.ai_overage_invoices (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  period_start         timestamptz not null,
  period_end           timestamptz not null,
  overage_credits      numeric(18,4) not null,
  price_eur_per_credit numeric(10,4) not null,
  amount_eur           numeric(12,2) not null,
  currency             text not null default 'EUR',
  status               text not null default 'pending',  -- pending | invoiced | paid | waived | failed
  provider             text,                              -- stripe | pawapay
  stripe_invoice_id    text,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  settled_at           timestamptz
);
create index if not exists idx_overage_inv_tenant on public.ai_overage_invoices(tenant_id, created_at desc);
create index if not exists idx_overage_inv_status on public.ai_overage_invoices(status);

-- RLS deny-by-default : seul service_role (l'API filtre par tenant). Données privées.
alter table public.ai_overage_invoices enable row level security;
drop policy if exists "service_role_full_overage_inv" on public.ai_overage_invoices;
create policy "service_role_full_overage_inv" on public.ai_overage_invoices
  to service_role using (true) with check (true);

-- ─── 4) Helper : prix overage effectif d'un plan ────────────────────────────────
create or replace function public.ai_overage_price(p_plan text)
returns numeric language sql stable as $$
  select coalesce(
    (select overage_price_eur from public.ai_plan_quotas where plan_tier = p_plan),
    0.02
  );
$$;

-- ─── 5) debit_ai_credits — désormais conscient du dépassement (opt-in + plafond) ─
create or replace function debit_ai_credits(
  p_tenant_id UUID,
  p_amount NUMERIC,
  p_function_name TEXT,
  p_model TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_unit_type TEXT DEFAULT 'tokens_in',
  p_unit_amount NUMERIC DEFAULT 0,
  p_session_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance NUMERIC(18,4);
  v_blocked BOOLEAN;
  v_overage_enabled BOOLEAN;
  v_overage_credits NUMERIC(18,4);
  v_overage_cap_eur NUMERIC(10,2);
  v_plan TEXT;
  v_price NUMERIC;
  v_new_balance NUMERIC(18,4);
  v_overage_portion NUMERIC(18,4);
  v_projected_eur NUMERIC;
  v_usage_id UUID;
BEGIN
  SELECT balance_credits, is_blocked, overage_enabled, overage_credits, overage_cap_eur, plan_tier
    INTO v_balance, v_blocked, v_overage_enabled, v_overage_credits, v_overage_cap_eur, v_plan
  FROM ai_credit_balances WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM init_tenant_ai_balance(p_tenant_id, 'free');
    SELECT balance_credits, is_blocked, overage_enabled, overage_credits, overage_cap_eur, plan_tier
      INTO v_balance, v_blocked, v_overage_enabled, v_overage_credits, v_overage_cap_eur, v_plan
    FROM ai_credit_balances WHERE tenant_id = p_tenant_id FOR UPDATE;
  END IF;

  IF v_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'TENANT_BLOCKED', 'message', 'Compte IA suspendu');
  END IF;

  IF v_balance >= p_amount THEN
    -- Solde suffisant → débit normal
    v_new_balance := v_balance - p_amount;
    v_overage_portion := 0;
  ELSE
    -- Dépassement : autorisé UNIQUEMENT si le tenant a opté (fail-closed)
    IF NOT COALESCE(v_overage_enabled, false) THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'INSUFFICIENT_CREDITS',
        'message', 'Solde insuffisant. Achetez un pack de crédits ou activez le dépassement à l''usage.',
        'balance', v_balance, 'required', p_amount);
    END IF;
    -- Portion réellement en dépassement (ce qui passe sous zéro)
    v_overage_portion := p_amount - GREATEST(v_balance, 0);
    v_price := public.ai_overage_price(v_plan);
    v_projected_eur := (v_overage_credits + v_overage_portion) * v_price;
    IF v_projected_eur > v_overage_cap_eur THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'OVERAGE_CAP_REACHED',
        'message', 'Plafond de dépassement atteint. Achetez un pack ou augmentez le plafond.',
        'balance', v_balance, 'required', p_amount,
        'overage_credits', v_overage_credits, 'overage_cap_eur', v_overage_cap_eur,
        'projected_overage_eur', round(v_projected_eur, 2));
    END IF;
    v_new_balance := v_balance - p_amount;                 -- devient négatif
    v_overage_credits := v_overage_credits + v_overage_portion;
  END IF;

  INSERT INTO ai_usage_events (tenant_id, user_id, function_name, model, provider, unit_type, unit_amount, credits_charged, session_id, metadata)
  VALUES (p_tenant_id, p_user_id, p_function_name, p_model, p_provider, p_unit_type, p_unit_amount, p_amount, p_session_id, p_metadata)
  RETURNING id INTO v_usage_id;

  UPDATE ai_credit_balances
    SET balance_credits = v_new_balance,
        overage_credits = v_overage_credits,
        total_consumed  = total_consumed + p_amount,
        updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO ai_credit_transactions (tenant_id, amount, balance_after, type, reference, description, metadata)
  VALUES (p_tenant_id, -p_amount, v_new_balance, 'ai_usage', v_usage_id::text,
          p_function_name || ' (' || COALESCE(p_model,'') || ')',
          COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('overage_portion', v_overage_portion));

  RETURN jsonb_build_object(
    'success', true, 'balance', v_new_balance, 'charged', p_amount, 'usage_id', v_usage_id,
    'overage_portion', v_overage_portion, 'overage_credits', v_overage_credits);
END;
$$;

-- ─── 6) run_monthly_ai_refill — ne JAMAIS reporter une dette (floor à 0) ─────────
--     Sans ce floor, un solde négatif (dépassement) mangerait le quota du mois
--     suivant → crédits gratuits. L'overage_credits reste facturé indépendamment.
CREATE OR REPLACE FUNCTION run_monthly_ai_refill()
RETURNS TABLE(tenant_id UUID, plan_tier TEXT, refilled_amount NUMERIC, new_balance NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant RECORD;
  v_quota_row RECORD;
  v_capped_rollover NUMERIC(18,4);
  v_new_balance NUMERIC(18,4);
BEGIN
  FOR v_tenant IN
    SELECT b.tenant_id, b.plan_tier, b.balance_credits, b.next_refill_at
    FROM ai_credit_balances b
    WHERE b.is_blocked = false
      AND (b.next_refill_at IS NULL OR b.next_refill_at <= NOW())
  LOOP
    SELECT monthly_credits, rollover_max INTO v_quota_row
    FROM ai_plan_quotas WHERE ai_plan_quotas.plan_tier = v_tenant.plan_tier;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Floor à 0 : une dette de dépassement ne se reporte pas dans le quota
    v_capped_rollover := LEAST(GREATEST(v_tenant.balance_credits, 0), v_quota_row.rollover_max);
    v_new_balance := v_capped_rollover + v_quota_row.monthly_credits;

    UPDATE ai_credit_balances
      SET balance_credits = v_new_balance,
          next_refill_at = NOW() + INTERVAL '1 month',
          updated_at = NOW()
      WHERE ai_credit_balances.tenant_id = v_tenant.tenant_id;

    INSERT INTO ai_credit_transactions (tenant_id, amount, balance_after, type, description, metadata)
    VALUES (v_tenant.tenant_id, v_quota_row.monthly_credits, v_new_balance, 'subscription_refill',
       'Refill mensuel auto — plan ' || v_tenant.plan_tier,
       jsonb_build_object('capped_rollover', v_capped_rollover, 'previous_balance', v_tenant.balance_credits));

    tenant_id := v_tenant.tenant_id;
    plan_tier := v_tenant.plan_tier;
    refilled_amount := v_quota_row.monthly_credits;
    new_balance := v_new_balance;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ─── 7) settle_ai_overage — règlement de fin de mois (crée les factures pending) ─
create or replace function settle_ai_overage(p_now timestamptz default now())
returns table(tenant_id uuid, overage_credits numeric, amount_eur numeric, invoice_id uuid)
language plpgsql security definer as $$
declare
  v_row record;
  v_price numeric;
  v_amount numeric;
  v_invoice_id uuid;
  v_period_start timestamptz;
  v_new_balance numeric(18,4);
begin
  for v_row in
    select b.tenant_id as tid, b.plan_tier, b.overage_credits as oc, b.balance_credits as bc
    from ai_credit_balances b
    where b.overage_credits > 0
  loop
    v_price := public.ai_overage_price(v_row.plan_tier);
    v_amount := round(v_row.oc * v_price, 2);
    v_period_start := date_trunc('month', p_now) - interval '1 month';
    v_new_balance := greatest(v_row.bc, 0);

    insert into ai_overage_invoices
      (tenant_id, period_start, period_end, overage_credits, price_eur_per_credit, amount_eur, status, metadata)
    values
      (v_row.tid, v_period_start, p_now, v_row.oc, v_price, v_amount, 'pending',
       jsonb_build_object('plan_tier', v_row.plan_tier))
    returning id into v_invoice_id;

    -- La dette est désormais sur une facture : on repart de 0 (jamais de report négatif)
    update ai_credit_balances
      set overage_credits = 0,
          balance_credits = v_new_balance,
          updated_at = now()
    where ai_credit_balances.tenant_id = v_row.tid;

    insert into ai_credit_transactions (tenant_id, amount, balance_after, type, reference, description, metadata)
    values (v_row.tid, 0, v_new_balance, 'overage_settlement', v_invoice_id::text,
            'Règlement dépassement — ' || v_row.oc || ' cr → ' || v_amount || ' €',
            jsonb_build_object('amount_eur', v_amount, 'overage_credits', v_row.oc, 'price_eur', v_price));

    tenant_id := v_row.tid;
    overage_credits := v_row.oc;
    amount_eur := v_amount;
    invoice_id := v_invoice_id;
    return next;
  end loop;
end;
$$;

comment on function settle_ai_overage is
  'Règlement mensuel du dépassement IA : crée les factures pending (aucun prélèvement auto).';

-- ─── 8) pg_cron : règlement le 1er de chaque mois à 03:00 UTC ────────────────────
--     (le refill tourne à 02:00 ; le floor du refill garantit que la dette n''est
--      pas absorbée. overage_credits reste la vérité de facturation dans tous les cas.)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('liri-ai-overage-settle')
      where exists (select 1 from cron.job where jobname = 'liri-ai-overage-settle');
    perform cron.schedule('liri-ai-overage-settle', '0 3 1 * *', $cron$select settle_ai_overage();$cron$);
    raise notice 'Cron liri-ai-overage-settle scheduled (0 3 1 * * UTC)';
  else
    raise notice 'pg_cron absent — règlement manuel via settle_ai_overage() requis';
  end if;
end $$;

-- ─── 9) Vues fondateur : dépassement en cours d'accumulation + factures à régler ─
create or replace view ai_overage_accruing as
select b.tenant_id, t.name as tenant_name, t.slug, b.plan_tier, b.overage_enabled,
       b.overage_credits, public.ai_overage_price(b.plan_tier) as price_eur_per_credit,
       round(b.overage_credits * public.ai_overage_price(b.plan_tier), 2) as accrued_eur,
       b.overage_cap_eur
from ai_credit_balances b join tenants t on t.id = b.tenant_id
where b.overage_credits > 0 or b.overage_enabled = true
order by accrued_eur desc;

create or replace view ai_overage_pending as
select i.id, i.tenant_id, t.name as tenant_name, t.slug, i.period_start, i.period_end,
       i.overage_credits, i.price_eur_per_credit, i.amount_eur, i.currency, i.status, i.created_at
from ai_overage_invoices i join tenants t on t.id = i.tenant_id
where i.status = 'pending'
order by i.created_at desc;
