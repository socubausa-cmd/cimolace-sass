-- ═════════════════════════════════════════════════════════════════════════════
-- LIRI AI Billing — Cron auto-refill mensuel
--
-- Tous les jours à 02:00 UTC, on cherche les tenants dont next_refill_at < NOW()
-- et on les recharge automatiquement avec leur monthly_quota.
--
-- Cap de rollover : le solde existant est plafonné à `rollover_max` du plan
-- avant de cumuler le nouveau quota.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) Fonction qui refill tous les tenants éligibles en batch
CREATE OR REPLACE FUNCTION run_monthly_ai_refill()
RETURNS TABLE(tenant_id UUID, plan_tier TEXT, refilled_amount NUMERIC, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    -- Capper le rollover avant d'ajouter le nouveau quota
    v_capped_rollover := LEAST(v_tenant.balance_credits, v_quota_row.rollover_max);
    v_new_balance := v_capped_rollover + v_quota_row.monthly_credits;

    UPDATE ai_credit_balances
      SET balance_credits = v_new_balance,
          next_refill_at = NOW() + INTERVAL '1 month',
          updated_at = NOW()
      WHERE ai_credit_balances.tenant_id = v_tenant.tenant_id;

    INSERT INTO ai_credit_transactions
      (tenant_id, amount, balance_after, type, description, metadata)
    VALUES
      (v_tenant.tenant_id, v_quota_row.monthly_credits, v_new_balance,
       'subscription_refill',
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

COMMENT ON FUNCTION run_monthly_ai_refill IS
  'Refill auto mensuel des crédits IA pour tous les tenants dont next_refill_at est dépassé.';

-- 2) Schedule via pg_cron — tous les jours à 02:00 UTC
-- Vérifier que l'extension pg_cron est activée
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop l'ancien job s'il existe
    PERFORM cron.unschedule('liri-ai-monthly-refill')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'liri-ai-monthly-refill');

    -- Schedule daily at 02:00 UTC
    PERFORM cron.schedule(
      'liri-ai-monthly-refill',
      '0 2 * * *',
      $cron$SELECT run_monthly_ai_refill();$cron$
    );

    RAISE NOTICE 'Cron liri-ai-monthly-refill scheduled at 02:00 UTC daily';
  ELSE
    RAISE NOTICE 'Extension pg_cron non installée — refill manuel via run_monthly_ai_refill() requis';
  END IF;
END $$;

-- 3) Vue de debug pour les tenants en attente de refill
CREATE OR REPLACE VIEW ai_billing_tenants_awaiting_refill AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  b.plan_tier,
  b.balance_credits,
  b.monthly_quota,
  b.next_refill_at,
  b.is_blocked,
  EXTRACT(EPOCH FROM (NOW() - b.next_refill_at)) / 3600 as hours_overdue
FROM ai_credit_balances b
JOIN tenants t ON t.id = b.tenant_id
WHERE b.next_refill_at IS NOT NULL
  AND b.next_refill_at <= NOW()
  AND b.is_blocked = false
ORDER BY b.next_refill_at;

COMMENT ON VIEW ai_billing_tenants_awaiting_refill IS
  'Tenants dont le next_refill_at est dépassé (debug pour vérifier le bon fonctionnement du cron).';
