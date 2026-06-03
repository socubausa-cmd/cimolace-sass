import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PawaPayService } from '../pawapay/pawapay.service';

/**
 * Cycle de vie des abonnements mensuels Ngowazulu payés par PawaPay (Mobile Money).
 *
 * pawaPay n'a PAS de prélèvement récurrent natif : on ne peut pas débiter
 * silencieusement. Le modèle est donc « app-driven » :
 *   1. Un dépôt COMPLETED (kind=subscription) crée/prolonge la billing_subscription (+1 mois).
 *   2. Un planificateur (processDueRenewals) relance, pour chaque abonnement échu,
 *      un NOUVEAU dépôt push-to-approve sur le numéro Mobile Money mémorisé.
 *      L'utilisateur valide par PIN → le webhook COMPLETED prolonge l'abonnement.
 *
 * ⚠️ Non testé au runtime (nécessite PAWAPAY_API_TOKEN + migrations appliquées
 *    + webhook pawaPay configuré). Vérifié à la compilation + mapping des routes.
 */
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);
  private static readonly PERIOD_DAYS = 30;

  constructor(
    private readonly auth: AuthService,
    private readonly pawapay: PawaPayService,
  ) {}

  private get supabase() {
    return this.auth.getClient();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ppDeposits() {
    return (this.supabase as any).from('pawapay_deposits');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get subs() {
    return (this.supabase as any).from('billing_subscriptions');
  }

  private addDaysISO(base: Date, days: number): string {
    return new Date(base.getTime() + days * 86_400_000).toISOString();
  }

  // ── Webhook pawaPay ────────────────────────────────────────────────────────
  /**
   * Traite le callback pawaPay (POST /offering-checkout/webhook/pawapay).
   * Met à jour le dépôt ; sur COMPLETED + kind=subscription, crée/prolonge l'abonnement.
   */
  async handlePawaPayCallback(rawBody: Buffer, signature?: string): Promise<void> {
    if (signature !== undefined && !this.pawapay.verifyCallbackSignature(rawBody, signature)) {
      throw new BadRequestException('Signature callback pawaPay invalide');
    }

    let payload: {
      depositId?: string;
      status?: string;
      providerTransactionId?: string;
      failureReason?: { failureCode?: string; failureMessage?: string };
    };
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Payload pawaPay invalide (JSON malformé)');
    }

    const { depositId, status, providerTransactionId, failureReason } = payload;
    if (!depositId || !status) {
      this.logger.warn('Callback pawaPay sans depositId/status');
      return;
    }

    await this.ppDeposits
      .update({
        pawapay_status: status,
        provider_tx_id: providerTransactionId ?? null,
        failure_code: failureReason?.failureCode ?? null,
        failure_message: failureReason?.failureMessage ?? null,
      })
      .eq('deposit_id', depositId);

    if (status !== 'COMPLETED') return;

    const { data: deposit } = await this.ppDeposits
      .select('user_id, kind, plan_slug')
      .eq('deposit_id', depositId)
      .maybeSingle();

    if (deposit?.kind === 'subscription' && deposit.plan_slug) {
      await this.createOrExtendSubscription(deposit.user_id, deposit.plan_slug);
    }
    this.logger.log(`pawaPay COMPLETED traité — depositId=${depositId} kind=${deposit?.kind}`);
  }

  /** Crée (ou prolonge de +1 mois) l'abonnement mensuel d'un utilisateur sur un plan. */
  async createOrExtendSubscription(userId: string, planSlug: string): Promise<void> {
    const { data: plan } = await this.subsPlanBySlug(planSlug);
    if (!plan) {
      this.logger.warn(`createOrExtendSubscription : plan introuvable slug=${planSlug}`);
      return;
    }

    const { data: existing } = await this.subs
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('plan_id', plan.id)
      .eq('provider', 'pawapay')
      .in('status', ['active', 'past_due', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    if (existing) {
      // Prolonge à partir de la fin courante si elle est dans le futur, sinon à partir de maintenant
      const from = existing.expires_at && new Date(existing.expires_at) > now ? new Date(existing.expires_at) : now;
      const newExpiry = this.addDaysISO(from, SubscriptionRenewalService.PERIOD_DAYS);
      await this.subs
        .update({
          status: 'active',
          expires_at: newExpiry,
          next_renewal_due_at: newExpiry,
          last_reminder_sent_at: null,
          reminder_stage: 'none',
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id);
      this.logger.log(`Abonnement prolongé — user=${userId} plan=${planSlug} → ${newExpiry}`);
    } else {
      const expiry = this.addDaysISO(now, SubscriptionRenewalService.PERIOD_DAYS);
      await this.subs.insert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        provider: 'pawapay',
        payment_method: 'mobile_money',
        started_at: now.toISOString(),
        expires_at: expiry,
        next_renewal_due_at: expiry,
        auto_renew_enabled: true,
      });
      this.logger.log(`Abonnement créé — user=${userId} plan=${planSlug} → ${expiry}`);
    }
  }

  private async subsPlanBySlug(slug: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.supabase as any)
      .from('billing_plans')
      .select('id, slug, price_amount, price_currency')
      .eq('slug', slug)
      .maybeSingle();
  }

  // ── Planificateur de renouvellement ─────────────────────────────────────────
  /**
   * Relance un dépôt Mobile Money pour chaque abonnement PawaPay échu et
   * auto-renouvelable (push-to-approve). À déclencher par un cron externe
   * (worker / Inngest / Cloud Scheduler) via POST /offering-checkout/renewals/run.
   */
  async processDueRenewals(limit = 50): Promise<{ scanned: number; initiated: number; skipped: number }> {
    if (!this.pawapay.isConfigured) {
      this.logger.warn('processDueRenewals : PAWAPAY_API_TOKEN non configuré — abandon');
      return { scanned: 0, initiated: 0, skipped: 0 };
    }

    const nowIso = new Date().toISOString();
    const reminderFloor = this.addDaysISO(new Date(), -1); // pas plus d'une relance / 24h

    const { data: due } = await this.subs
      .select('id, user_id, plan_id, last_reminder_sent_at, billing_plans!inner(slug)')
      .eq('provider', 'pawapay')
      .eq('status', 'active')
      .eq('auto_renew_enabled', true)
      .lte('next_renewal_due_at', nowIso)
      .limit(limit);

    const rows: any[] = Array.isArray(due) ? due : [];
    let initiated = 0;
    let skipped = 0;

    for (const sub of rows) {
      if (sub.last_reminder_sent_at && sub.last_reminder_sent_at > reminderFloor) {
        skipped++;
        continue;
      }
      const planSlug: string | undefined = sub.billing_plans?.slug;
      if (!planSlug) {
        skipped++;
        continue;
      }

      // Réutilise le dernier moyen Mobile Money connu de cet utilisateur pour ce plan
      const { data: lastDep } = await this.ppDeposits
        .select('phone_number, provider, country, amount_cents, currency, tenant_id')
        .eq('user_id', sub.user_id)
        .eq('plan_slug', planSlug)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastDep?.phone_number) {
        skipped++;
        continue;
      }

      try {
        const depositId = randomUUID();
        await this.ppDeposits.insert({
          deposit_id: depositId,
          tenant_id: lastDep.tenant_id,
          user_id: sub.user_id,
          amount_cents: lastDep.amount_cents,
          currency: lastDep.currency || 'EUR',
          provider: lastDep.provider,
          phone_number: lastDep.phone_number,
          country: lastDep.country,
          pawapay_status: 'PENDING',
          kind: 'subscription',
          plan_slug: planSlug,
        });
        const res = await this.pawapay.initiateDeposit({
          depositId,
          amount: String(Math.round(lastDep.amount_cents)),
          currency: lastDep.currency || 'EUR',
          payer: {
            type: 'MMO',
            accountDetails: { phoneNumber: lastDep.phone_number, provider: lastDep.provider },
          },
          statementDescription: 'PRORASCIENCE',
          metadata: { userId: sub.user_id, kind: 'subscription', planSlug },
        });
        await this.ppDeposits.update({ pawapay_status: res.status }).eq('deposit_id', depositId);
        await this.subs
          .update({ last_reminder_sent_at: nowIso, reminder_stage: 'renewal_initiated' })
          .eq('id', sub.id);
        initiated++;
      } catch (e) {
        this.logger.error(`Relance échouée sub=${sub.id}: ${(e as Error).message}`);
        skipped++;
      }
    }

    this.logger.log(`Renouvellements : scanned=${rows.length} initiated=${initiated} skipped=${skipped}`);
    return { scanned: rows.length, initiated, skipped };
  }
}
