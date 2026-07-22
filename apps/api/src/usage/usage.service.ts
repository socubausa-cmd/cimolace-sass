import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type UsageMetric = 'live_minutes' | 'ai_credits';

/**
 * COMPTEUR D'USAGE PAR TENANT — minutes live (LiveKit) + crédits IA (LLM).
 *
 * Modèle économique : chaque palier d'abonnement inclut un quota mensuel
 * (billing_plans.metadata.quotas) ; au-delà, le tenant achète des PACKS
 * (billing_plans.category='credits') vendus ~10× le coût infra — la majoration
 * finance la plateforme, et le non-consommé expire en fin de mois.
 *
 * Règles :
 *  - le quota bloque le DÉMARRAGE d'un live, jamais un live en cours ni un join ;
 *  - le comptage est best-effort (ne casse JAMAIS l'opération métier) ;
 *  - les gardes sont fail-open : si le compteur est en panne, on laisse passer
 *    (une facture LiveKit de quelques euros vaut mieux qu'une plateforme morte).
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  constructor(private readonly supabase: SupabaseService) {}
  private get db() {
    return this.supabase.client;
  }

  /** Quotas par défaut SANS abonnement payant (essai) — volontairement petits. */
  private static readonly DEFAULTS: Record<UsageMetric, number> = {
    live_minutes: 500,
    ai_credits: 25,
  };

  /** 1er jour du mois courant (UTC) — clé de période du compteur. */
  private static period(): string {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
  }

  /** Quota inclus selon l'abonnement primaire actif (billing_plans.metadata.quotas). */
  async includedQuotas(tenantId: string): Promise<Record<UsageMetric, number>> {
    const out = { ...UsageService.DEFAULTS };
    try {
      const { data: subs } = await this.db
        .from('billing_subscriptions')
        .select('plan_id')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due', 'unpaid'])
        .order('amount_cents', { ascending: false })
        .limit(1);
      const planKey = (subs?.[0] as any)?.plan_id;
      if (!planKey) return out;
      const { data: plan } = await this.db
        .from('billing_plans')
        .select('metadata')
        .eq('key', planKey)
        .maybeSingle();
      const q = ((plan as any)?.metadata?.quotas ?? {}) as Record<string, unknown>;
      for (const m of ['live_minutes', 'ai_credits'] as UsageMetric[]) {
        const n = Number(q[m]);
        if (Number.isFinite(n) && n >= 0) out[m] = n;
      }
    } catch {
      /* fail-open sur les défauts */
    }
    return out;
  }

  /** Conso + crédits + reste du mois courant (pour l'UI et les gardes). */
  async getUsage(tenantId: string) {
    const period = UsageService.period();
    const included = await this.includedQuotas(tenantId);
    const { data } = await this.db
      .from('tenant_usage_monthly')
      .select('metric, used, extra')
      .eq('tenant_id', tenantId)
      .eq('period', period);
    const rows = new Map((data ?? []).map((r: any) => [r.metric, r]));
    const mk = (m: UsageMetric) => {
      const r: any = rows.get(m) ?? { used: 0, extra: 0 };
      const extra = Number(r.extra ?? 0);
      const used = Number(r.used ?? 0);
      return {
        included: included[m],
        extra,
        used,
        remaining: Math.max(0, included[m] + extra - used),
      };
    };
    return { period, live_minutes: mk('live_minutes'), ai_credits: mk('ai_credits') };
  }

  /** Reste disponible ; null si le calcul échoue (fail-open). */
  async remainingSafe(tenantId: string, metric: UsageMetric): Promise<number | null> {
    try {
      const u = await this.getUsage(tenantId);
      return (u as any)[metric].remaining as number;
    } catch (e) {
      this.logger.warn(`remainingSafe(${metric}): ${(e as Error).message}`);
      return null;
    }
  }

  /** Consommation best-effort (la RPC avale aussi ses erreurs côté SQL). */
  async consume(
    tenantId: string,
    metric: UsageMetric,
    amount: number,
    source: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    if (!tenantId || !(amount > 0)) return;
    try {
      await (this.db as any).rpc('usage_consume', {
        p_tenant: tenantId,
        p_metric: metric,
        p_amount: Math.round(amount * 100) / 100,
        p_source: source,
        p_meta: meta,
      });
    } catch (e) {
      this.logger.warn(`usage_consume(${metric}): ${(e as Error).message}`);
    }
  }

  /** Créditer (achat de pack) — période courante, expire fin de mois. */
  async addCredits(tenantId: string, metric: UsageMetric, amount: number, source: string) {
    const { error } = await (this.db as any).rpc('usage_add_credits', {
      p_tenant: tenantId,
      p_metric: metric,
      p_amount: amount,
      p_source: source,
    });
    if (error) throw new BadRequestException(`Crédit impossible: ${error.message}`);
  }

  /** Garde anti-ruine au DÉMARRAGE d'un live (jamais sur un join / live en cours). */
  async assertCanStartLive(tenantId: string): Promise<void> {
    const rem = await this.remainingSafe(tenantId, 'live_minutes');
    if (rem !== null && rem <= 0) {
      throw new ForbiddenException(
        'Quota de minutes live du mois épuisé. Achetez un pack de minutes (Facturation → Packs) ou passez au palier supérieur — les lives déjà en cours ne sont jamais coupés.',
      );
    }
  }

  /** Garde crédits IA : consomme 1 crédit ou refuse (message d'upsell). */
  async assertAiCredit(tenantId: string, source: string): Promise<void> {
    const rem = await this.remainingSafe(tenantId, 'ai_credits');
    if (rem !== null && rem <= 0) {
      throw new ForbiddenException(
        'Crédits IA du mois épuisés. Achetez un pack IA (Facturation → Packs) ou passez au palier supérieur.',
      );
    }
    await this.consume(tenantId, 'ai_credits', 1, source);
  }

  // ─── Achat de packs (Stripe one-time, mode=payment) ─────────────────────────

  private stripeAuth() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new BadRequestException('Paiement carte indisponible (STRIPE_SECRET_KEY non configurée)');
    }
    return `Basic ${Buffer.from(secret + ':').toString('base64')}`;
  }

  /** Catalogue des packs achetables (affichage UI). */
  async listPacks() {
    const { data } = await this.db
      .from('billing_plans')
      .select('key, label, description, price_cents, currency, metadata')
      .eq('category', 'credits')
      .eq('is_active', true)
      .order('price_cents');
    return data ?? [];
  }

  /**
   * Crée une session Stripe Checkout ONE-TIME pour un pack de crédits.
   * Prix lu en base (jamais fourni par le client). Le webhook (credit_pack)
   * crédite le compteur au paiement abouti.
   */
  async createPackCheckout(tenantId: string, packKey: string) {
    const { data: pack } = await this.db
      .from('billing_plans')
      .select('key, label, price_cents, currency, metadata, is_active')
      .eq('key', packKey)
      .eq('category', 'credits')
      .maybeSingle();
    if (!pack || (pack as any).is_active === false) throw new NotFoundException('Pack introuvable');
    const metric = (pack as any)?.metadata?.credit_metric as UsageMetric;
    const amount = Number((pack as any)?.metadata?.credit_amount ?? 0);
    const price = Number((pack as any)?.price_cents ?? 0);
    if (!['live_minutes', 'ai_credits'].includes(metric) || !(amount > 0) || !(price > 0)) {
      throw new BadRequestException('Pack mal configuré (credit_metric/credit_amount/price)');
    }

    const frontend = process.env.FRONTEND_URL || 'https://app.cimolace.space';
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price_data][currency]', String((pack as any).currency ?? 'EUR').toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(price));
    params.append('line_items[0][price_data][product_data][name]', String((pack as any).label ?? packKey));
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${frontend}/cimolace/billing?pack=success`);
    params.append('cancel_url', `${frontend}/cimolace/billing?pack=cancel`);
    params.append('metadata[credit_pack]', packKey);
    params.append('metadata[tenant_id]', tenantId);
    params.append('metadata[credit_metric]', metric);
    params.append('metadata[credit_amount]', String(amount));

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: this.stripeAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new BadRequestException(`Stripe error ${res.status}: ${t.slice(0, 200)}`);
    }
    const session = (await res.json()) as { id: string; url: string };
    return { url: session.url, session_id: session.id, pack: packKey };
  }

  /**
   * Appliqué par le webhook Stripe sur checkout.session.completed (mode=payment,
   * metadata.credit_pack). L'idempotence (event.id) est gérée par l'appelant.
   */
  async applyPackFromCheckout(sessionMeta: any, sessionId: string): Promise<boolean> {
    const tenantId = sessionMeta?.tenant_id as string | undefined;
    const packKey = sessionMeta?.credit_pack as string | undefined;
    const metric = sessionMeta?.credit_metric as UsageMetric;
    const amount = Number(sessionMeta?.credit_amount ?? 0);
    if (!tenantId || !['live_minutes', 'ai_credits'].includes(metric) || !(amount > 0)) return false;
    await this.addCredits(tenantId, metric, amount, `pack:${packKey ?? '?'}:${sessionId}`);
    this.logger.log(`[packs] +${amount} ${metric} pour tenant ${tenantId} (${packKey})`);
    return true;
  }
}
