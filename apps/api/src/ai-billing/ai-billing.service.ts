/**
 * AiBillingService — Gestion des crédits IA (LIRI Credits) par tenant.
 *
 * Responsabilités :
 *   - Lire le solde courant
 *   - Calculer le coût d'un appel IA selon le pricing
 *   - Débiter atomiquement (via RPC Postgres)
 *   - Créditer (refill abonnement, achat de pack, refund)
 *   - Statistiques d'usage (par fonction, par modèle, par jour)
 *   - Gérer les packs de top-up et les plans
 */

import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type AiUnitType = 'tokens_in' | 'tokens_out' | 'chars' | 'seconds' | 'images' | 'requests';

export interface AiPricing {
  provider: string;
  model: string;
  unit_type: AiUnitType;
  credits_per_unit: number;
  unit_label?: string;
}

export interface AiUsageRecord {
  function_name: string;
  model?: string;
  provider?: string;
  unit_type: AiUnitType;
  unit_amount: number;
  session_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiBillingService {
  private readonly logger = new Logger(AiBillingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─── BALANCE ──────────────────────────────────────────────────────────────

  async getBalance(tenantId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('ai_credit_balances')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);

    // Auto-init si pas encore créé
    if (!data) {
      await (this.supabase.client as any).rpc('init_tenant_ai_balance', {
        p_tenant_id: tenantId,
        p_plan: 'free',
      });
      const { data: fresh } = await (this.supabase.client as any)
        .from('ai_credit_balances')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      return fresh;
    }
    return data;
  }

  // ─── PRICING ──────────────────────────────────────────────────────────────

  async getPricing(): Promise<AiPricing[]> {
    const { data } = await (this.supabase.client as any)
      .from('ai_pricing')
      .select('provider, model, unit_type, credits_per_unit, unit_label')
      .eq('is_active', true)
      .order('provider')
      .order('model');
    return data ?? [];
  }

  /** Calcule le coût d'un appel IA selon le pricing en base */
  async estimateCost(input: {
    provider: string;
    model: string;
    unit_type: AiUnitType;
    unit_amount: number;
  }): Promise<number> {
    const { data } = await (this.supabase.client as any)
      .from('ai_pricing')
      .select('credits_per_unit')
      .eq('provider', input.provider)
      .eq('model', input.model)
      .eq('unit_type', input.unit_type)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      this.logger.warn(`Aucun prix défini pour ${input.provider}/${input.model}/${input.unit_type}`);
      return 0; // gratuit si pricing inconnu (à monitorer)
    }
    return parseFloat(data.credits_per_unit) * input.unit_amount;
  }

  // ─── DÉBIT (via RPC atomique) ─────────────────────────────────────────────

  /**
   * Débite des crédits atomiquement.
   * Retourne { success: true, balance } ou { success: false, error: 'INSUFFICIENT_CREDITS', ... }
   */
  async debitCredits(
    tenantId: string,
    creditsAmount: number,
    usage: AiUsageRecord,
  ): Promise<{ success: boolean; balance?: number; error?: string; message?: string; required?: number }> {
    const { data, error } = await (this.supabase.client as any).rpc('debit_ai_credits', {
      p_tenant_id: tenantId,
      p_amount: creditsAmount,
      p_function_name: usage.function_name,
      p_model: usage.model ?? null,
      p_provider: usage.provider ?? null,
      p_unit_type: usage.unit_type,
      p_unit_amount: usage.unit_amount,
      p_session_id: usage.session_id ?? null,
      p_user_id: usage.user_id ?? null,
      p_metadata: usage.metadata ?? {},
    });

    if (error) {
      this.logger.error('debit_ai_credits RPC error:', error.message);
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }
    return data;
  }

  /** Helper : estimer + débiter en 1 appel */
  async chargeUsage(tenantId: string, usage: AiUsageRecord & { provider: string; model: string }) {
    const cost = await this.estimateCost({
      provider: usage.provider,
      model: usage.model,
      unit_type: usage.unit_type,
      unit_amount: usage.unit_amount,
    });
    return this.debitCredits(tenantId, cost, usage);
  }

  // ─── CRÉDIT (refill, top-up, refund) ──────────────────────────────────────

  async creditCredits(
    tenantId: string,
    amount: number,
    type: 'subscription_refill' | 'topup_purchase' | 'refund' | 'adjustment',
    options?: { reference?: string; description?: string; metadata?: Record<string, unknown> },
  ) {
    const { data, error } = await (this.supabase.client as any).rpc('credit_ai_credits', {
      p_tenant_id: tenantId,
      p_amount: amount,
      p_type: type,
      p_reference: options?.reference ?? null,
      p_description: options?.description ?? null,
      p_metadata: options?.metadata ?? {},
    });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── HISTORIQUE & STATS ───────────────────────────────────────────────────

  async getTransactionHistory(tenantId: string, limit = 50) {
    const { data } = await (this.supabase.client as any)
      .from('ai_credit_transactions')
      .select('id, amount, balance_after, type, reference, description, created_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  }

  async getUsageEvents(tenantId: string, params?: {
    limit?: number;
    function_name?: string;
    since?: string;
  }) {
    let q = (this.supabase.client as any)
      .from('ai_usage_events')
      .select('id, function_name, model, provider, unit_type, unit_amount, credits_charged, session_id, created_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (params?.function_name) q = q.eq('function_name', params.function_name);
    if (params?.since) q = q.gte('created_at', params.since);
    q = q.limit(params?.limit ?? 100);

    const { data } = await q;
    return data ?? [];
  }

  /** Stats agrégées (par fonction, par modèle, par jour) */
  async getUsageStats(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const { data } = await (this.supabase.client as any)
      .from('ai_usage_events')
      .select('function_name, model, provider, credits_charged, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since);

    const events = (data ?? []) as Array<{ function_name: string; model: string; provider: string; credits_charged: number; created_at: string }>;

    // Agréger par fonction
    const byFunction: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const e of events) {
      const credits = parseFloat(String(e.credits_charged));
      byFunction[e.function_name] = (byFunction[e.function_name] ?? 0) + credits;
      const modelKey = `${e.provider}/${e.model}`;
      byModel[modelKey] = (byModel[modelKey] ?? 0) + credits;
      const day = e.created_at.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + credits;
    }

    const total = events.reduce((s, e) => s + parseFloat(String(e.credits_charged)), 0);

    return {
      total_credits_used: total,
      events_count: events.length,
      by_function: Object.entries(byFunction).map(([name, credits]) => ({ name, credits })).sort((a, b) => b.credits - a.credits),
      by_model: Object.entries(byModel).map(([name, credits]) => ({ name, credits })).sort((a, b) => b.credits - a.credits),
      by_day: Object.entries(byDay).map(([day, credits]) => ({ day, credits })).sort((a, b) => a.day.localeCompare(b.day)),
      since,
    };
  }

  // ─── PACKS ────────────────────────────────────────────────────────────────

  async listTopupPackages() {
    const { data } = await (this.supabase.client as any)
      .from('ai_topup_packages')
      .select('id, key, label, credits_amount, price_cents, currency, bonus_label, stripe_price_id, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  }

  async getTopupPackage(key: string) {
    const { data } = await (this.supabase.client as any)
      .from('ai_topup_packages')
      .select('*')
      .eq('key', key)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) throw new NotFoundException(`Pack "${key}" introuvable`);
    return data;
  }

  // ─── PLAN QUOTAS ──────────────────────────────────────────────────────────

  async listPlanQuotas() {
    const { data } = await (this.supabase.client as any)
      .from('ai_plan_quotas')
      .select('*')
      .order('monthly_credits');
    return data ?? [];
  }

  async setTenantPlan(tenantId: string, planTier: string) {
    const { data: quota } = await (this.supabase.client as any)
      .from('ai_plan_quotas')
      .select('monthly_credits')
      .eq('plan_tier', planTier)
      .maybeSingle();

    if (!quota) throw new NotFoundException(`Plan "${planTier}" inconnu`);

    const { data: balance } = await (this.supabase.client as any)
      .from('ai_credit_balances')
      .select('plan_tier')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!balance) {
      await (this.supabase.client as any).rpc('init_tenant_ai_balance', { p_tenant_id: tenantId, p_plan: planTier });
    } else {
      await (this.supabase.client as any)
        .from('ai_credit_balances')
        .update({
          plan_tier: planTier,
          monthly_quota: quota.monthly_credits,
          next_refill_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        })
        .eq('tenant_id', tenantId);
    }
    return { success: true, plan: planTier, monthly_quota: quota.monthly_credits };
  }

  /** Refill manuel mensuel (à appeler via cron / Stripe webhook) */
  async monthlyRefill(tenantId: string) {
    const { data: balance } = await (this.supabase.client as any)
      .from('ai_credit_balances')
      .select('plan_tier, balance_credits, monthly_quota')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!balance) throw new NotFoundException('Balance introuvable');

    const { data: quota } = await (this.supabase.client as any)
      .from('ai_plan_quotas')
      .select('monthly_credits, rollover_max')
      .eq('plan_tier', balance.plan_tier)
      .maybeSingle();

    if (!quota) throw new BadRequestException('Plan inconnu');

    // Capping du rollover
    const currentBalance = parseFloat(balance.balance_credits);
    const rolloverMax = parseFloat(quota.rollover_max);
    const cappedRollover = Math.min(currentBalance, rolloverMax);
    const newQuota = parseFloat(quota.monthly_credits);
    const addAmount = newQuota; // on ajoute la totalité du quota du mois

    // On reset le balance au capped rollover puis ajoute le quota
    await (this.supabase.client as any)
      .from('ai_credit_balances')
      .update({
        balance_credits: cappedRollover + addAmount,
        next_refill_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      })
      .eq('tenant_id', tenantId);

    return this.creditCredits(tenantId, addAmount, 'subscription_refill', {
      description: `Refill mensuel — plan ${balance.plan_tier} (+${addAmount} crédits)`,
      metadata: { capped_rollover: cappedRollover },
    });
  }

  // ─── DÉPASSEMENT À L'USAGE (overage postpaid) ─────────────────────────────

  /** Statut du dépassement pour un tenant (opt-in, accumulé, plafond, prix). */
  async getOverageStatus(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('ai_credit_balances')
      .select('overage_enabled, overage_credits, overage_cap_eur, plan_tier, balance_credits')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!data) {
      return {
        enabled: false, overage_credits: 0, cap_eur: 50,
        price_eur_per_credit: 0.02, accrued_eur: 0, plan_tier: 'free', eligible: false,
      };
    }

    const { data: q } = await (this.supabase.client as any)
      .from('ai_plan_quotas')
      .select('overage_price_eur, allow_overage')
      .eq('plan_tier', data.plan_tier)
      .maybeSingle();

    const price = parseFloat(q?.overage_price_eur ?? '') || 0.02;
    const oc = parseFloat(data.overage_credits ?? '0');
    const cap = parseFloat(data.overage_cap_eur ?? '50');
    return {
      enabled: !!data.overage_enabled,
      overage_credits: oc,
      cap_eur: cap,
      price_eur_per_credit: price,
      accrued_eur: Math.round(oc * price * 100) / 100,
      remaining_eur: Math.max(0, Math.round((cap - oc * price) * 100) / 100),
      plan_tier: data.plan_tier,
      // éligible à l'opt-in : plan payant (pro/business). Le fondateur peut élargir.
      eligible: ['pro', 'business'].includes(data.plan_tier) || !!q?.allow_overage,
    };
  }

  /** Active/désactive le dépassement + plafond anti-surprise (owner/admin tenant). */
  async setOverage(tenantId: string, input: { enabled?: boolean; cap_eur?: number }) {
    const patch: Record<string, unknown> = {};
    if (typeof input.enabled === 'boolean') patch.overage_enabled = input.enabled;
    if (typeof input.cap_eur === 'number' && isFinite(input.cap_eur) && input.cap_eur >= 0) {
      patch.overage_cap_eur = Math.min(input.cap_eur, 5000); // garde-fou dur : 5000 € max
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Rien à modifier (enabled et/ou cap_eur requis).');
    }
    // Fail-closed : n'autoriser l'activation que sur un plan éligible (pro/business
    // ou allow_overage). Cohérent avec l'UI et anti-dette pour le marché Afrique.
    if (input.enabled === true) {
      const status = await this.getOverageStatus(tenantId);
      if (!status.eligible) {
        throw new BadRequestException(
          'Le dépassement à l\'usage est réservé aux plans Pro et Business.',
        );
      }
    }
    // Assure l'existence du solde avant l'update
    await this.getBalance(tenantId);
    const { error } = await (this.supabase.client as any)
      .from('ai_credit_balances')
      .update(patch)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return this.getOverageStatus(tenantId);
  }

  /** [FONDATEUR] Liste les factures de dépassement à régler (status=pending). */
  async listPendingOverage() {
    const { data } = await (this.supabase.client as any)
      .from('ai_overage_pending')
      .select('*');
    return data ?? [];
  }

  /** [FONDATEUR] Déclenche le règlement de fin de mois (crée les factures pending). */
  async settleOverage() {
    const { data, error } = await (this.supabase.client as any).rpc('settle_ai_overage', {});
    if (error) throw new BadRequestException(error.message);
    return { settled: data ?? [] };
  }
}
