import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import {
  verifyStripeSignature,
  stripeFetchSubscription,
  unixToIso,
} from '../billing/stripe-rest.util';

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
      .select('user_id, kind, plan_slug, tenant_id')
      .eq('deposit_id', depositId)
      .maybeSingle();

    if (deposit?.kind === 'subscription' && deposit.plan_slug) {
      await this.createOrExtendSubscription(deposit.user_id, deposit.plan_slug, {
        tenantId: deposit.tenant_id,
        provider: 'pawapay',
      });
    }
    this.logger.log(`pawaPay COMPLETED traité — depositId=${depositId} kind=${deposit?.kind}`);
  }

  /**
   * Crée (ou prolonge de +1 mois) l'abonnement mensuel d'un utilisateur — schéma PROD réel
   * (`billing_subscriptions`: provider / plan_id=key / current_period_*; `billing_plans` clé = `key`).
   * Partagé pawaPay (app-driven) et Stripe (récurrent natif). Montant lu serveur depuis le plan.
   */
  async createOrExtendSubscription(
    userId: string,
    planSlug: string,
    opts: {
      tenantId?: string | null;
      provider?: string; // 'pawapay' | 'stripe'
      providerSubscriptionId?: string | null;
      providerCustomerId?: string | null;
      currentPeriodEnd?: string | null; // ISO (période Stripe faisant foi) ; sinon now+30j
    } = {},
  ): Promise<void> {
    const provider = opts.provider ?? 'pawapay';

    // Plan : schéma prod = billing_plans.key (pas .slug), price_cents, currency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (this.supabase as any)
      .from('billing_plans')
      .select('key, price_cents, currency')
      .eq('key', planSlug)
      .maybeSingle();
    if (!plan) {
      this.logger.warn(`createOrExtendSubscription : plan introuvable key=${planSlug}`);
      return;
    }

    // tenant_id est NOT NULL : fourni, sinon on résout isna actif.
    let tenantId = opts.tenantId ?? null;
    if (!tenantId) {
      const { data: t } = await this.supabase
        .from('tenants')
        .select('id')
        .eq('slug', 'isna')
        .eq('status', 'active')
        .maybeSingle();
      tenantId = t?.id ?? null;
    }
    if (!tenantId) {
      this.logger.warn('createOrExtendSubscription : tenant_id introuvable — abandon');
      return;
    }

    const now = new Date();

    const { data: existing } = await this.subs
      .select('id, current_period_end')
      .eq('user_id', userId)
      .eq('plan_id', plan.key)
      .eq('provider', provider)
      .in('status', ['active', 'past_due', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Période : Stripe fournit la fin faisant foi ; sinon prolonge +30j depuis la fin courante/maintenant.
    const computedEnd =
      opts.currentPeriodEnd ??
      this.addDaysISO(
        existing?.current_period_end && new Date(existing.current_period_end) > now
          ? new Date(existing.current_period_end)
          : now,
        SubscriptionRenewalService.PERIOD_DAYS,
      );

    if (existing) {
      const patch: Record<string, unknown> = {
        status: 'active',
        current_period_end: computedEnd,
        updated_at: now.toISOString(),
      };
      if (opts.providerSubscriptionId) patch.provider_subscription_id = opts.providerSubscriptionId;
      if (opts.providerCustomerId) patch.provider_customer_id = opts.providerCustomerId;
      await this.subs.update(patch).eq('id', existing.id);
      this.logger.log(`Abonnement prolongé — user=${userId} plan=${planSlug} (${provider}) → ${computedEnd}`);
    } else {
      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        user_id: userId,
        plan_id: plan.key,
        provider,
        status: 'active',
        amount_cents: plan.price_cents ?? 0,
        currency: plan.currency ?? 'EUR',
        current_period_start: now.toISOString(),
        current_period_end: computedEnd,
      };
      if (opts.providerSubscriptionId) row.provider_subscription_id = opts.providerSubscriptionId;
      if (opts.providerCustomerId) row.provider_customer_id = opts.providerCustomerId;
      await this.subs.insert(row);
      this.logger.log(`Abonnement créé — user=${userId} plan=${planSlug} (${provider}) → ${computedEnd}`);
    }
  }

  // ── Webhook Stripe des offres élève ─────────────────────────────────────────
  /**
   * Traite le webhook Stripe (POST /offering-checkout/webhook/stripe), signature vérifiée.
   * - checkout.session.completed (mode subscription) → crée/active l'abo mentorat (carte).
   * - checkout.session.completed (mode payment)      → offrande/consultation one-off : log.
   * - invoice.paid / invoice.payment_succeeded       → renouvellement Stripe : prolonge la période.
   */
  async handleStripeOfferingWebhook(rawBody: Buffer, signature?: string): Promise<void> {
    const secret =
      process.env.STRIPE_OFFERING_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('Webhook Stripe offering : aucun secret configuré — ignoré');
      return;
    }
    const event = verifyStripeSignature(rawBody, signature, secret);
    if (!event) throw new BadRequestException('Signature Stripe invalide');

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object ?? {};
      const meta = session.metadata ?? {};
      const userId: string | undefined = meta.user_id;
      const planSlug: string | undefined = meta.plan_slug;

      if (session.mode === 'subscription' && userId && planSlug) {
        const stripeSubId: string | null = session.subscription || null;
        const stripeSub = stripeSubId ? await stripeFetchSubscription(stripeSubId) : null;
        await this.createOrExtendSubscription(userId, planSlug, {
          tenantId: meta.tenant_id ?? null,
          provider: 'stripe',
          providerSubscriptionId: stripeSubId,
          providerCustomerId: session.customer ?? null,
          currentPeriodEnd: unixToIso(stripeSub?.current_period_end),
        });
        this.logger.log(`Stripe abo mentorat activé — user=${userId} plan=${planSlug} sub=${stripeSubId}`);
      } else {
        this.logger.log(
          `Stripe paiement unique complété — kind=${meta.kind} user=${userId} session=${session.id}`,
        );
      }
      return;
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const invoice = event.data?.object ?? {};
      // La 1re facture est déjà couverte par checkout.session.completed → pas de double prolongation.
      if (invoice.billing_reason === 'subscription_create') return;
      const stripeSubId = invoice.subscription;
      if (!stripeSubId) return;
      const { data: sub } = await this.subs
        .select('id')
        .eq('provider_subscription_id', stripeSubId)
        .maybeSingle();
      if (!sub) {
        this.logger.warn(`invoice.paid : abonnement Stripe introuvable sub=${stripeSubId}`);
        return;
      }
      const periodEnd =
        unixToIso(invoice.lines?.data?.[0]?.period?.end) ??
        this.addDaysISO(new Date(), SubscriptionRenewalService.PERIOD_DAYS);
      await this.subs
        .update({ status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
      this.logger.log(`Renouvellement Stripe — sub=${sub.id} → ${periodEnd}`);
      return;
    }
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
