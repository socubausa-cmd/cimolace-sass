import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import { TenantPaymentConfigService } from '../billing/tenant-payment-config/tenant-payment-config.service';
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
export class SubscriptionRenewalService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionRenewalService.name);
  private static readonly PERIOD_DAYS = 30;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly auth: AuthService,
    private readonly pawapay: PawaPayService,
    private readonly tenantPayments: TenantPaymentConfigService,
  ) {}

  /**
   * Poller serveur : le compte PawaPay est PARTAGÉ (callback configuré sur un autre
   * tenant — ex. afritrack), donc Cimolace ne reçoit PAS les callbacks. On interroge
   * nous-mêmes le statut des dépôts en attente toutes les 60 s et on active l'abo sur
   * COMPLETED. Substitut fiable du webhook. Désactivable via DISABLE_OFFERING_POLLER=1.
   */
  onApplicationBootstrap(): void {
    if (process.env.DISABLE_OFFERING_POLLER === '1') return;
    this.pollTimer = setInterval(() => {
      this.pollPendingOfferingDeposits().catch((e) =>
        this.logger.warn(`poller offering: ${(e as Error).message}`),
      );
    }, 60_000);
    this.pollTimer.unref?.();
    this.logger.log('Poller dépôts offering PawaPay armé (60 s)');
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

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
   *
   * SÉCURITÉ anti-forge : l'endpoint est PUBLIC et la signature n'est pas
   * garantie (secret non configuré → verifyCallbackSignature permissive). Or le
   * payeur connaît son depositId : accepter le statut du CORPS permettait de
   * forger { status:'COMPLETED' } et d'obtenir l'abonnement sans payer. Le
   * callback n'est donc qu'un RÉVEIL — le statut est TOUJOURS re-lu à la source
   * (compte PawaPay du tenant si configuré, sinon plateforme), puis appliqué via
   * applyDepositTerminal (transition ATOMIQUE anti-double, partagée avec le
   * poller — l'ancien chemin webhook doublonnait la logique SANS le claim →
   * risque de double prolongation webhook+poller).
   */
  async handlePawaPayCallback(rawBody: Buffer, signature?: string): Promise<void> {
    // Vérifiée INCONDITIONNELLEMENT (avant : sautée si l'en-tête était absent).
    if (!this.pawapay.verifyCallbackSignature(rawBody, signature ?? '')) {
      throw new BadRequestException('Signature callback pawaPay invalide');
    }

    let payload: { depositId?: string };
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Payload pawaPay invalide (JSON malformé)');
    }

    const depositId = payload?.depositId;
    if (!depositId) {
      this.logger.warn('Callback pawaPay sans depositId');
      return;
    }

    const { data: dep } = await this.ppDeposits
      .select('deposit_id, user_id, kind, plan_slug, tenant_id, pawapay_status, amount_cents, currency')
      .eq('deposit_id', depositId)
      .maybeSingle();
    if (!dep) {
      this.logger.warn(`Callback pawaPay : dépôt inconnu ${depositId}`);
      return;
    }

    const remote = await this.verifiedDepositStatus(depositId, dep.tenant_id ?? null);
    if (!remote?.status) {
      this.logger.warn(`Callback pawaPay : statut invérifiable ${depositId} — rien appliqué (poller/retry couvrent)`);
      return;
    }

    // Métadonnées VÉRIFIÉES (tx opérateur, raison d'échec) — jamais celles du corps.
    await this.ppDeposits
      .update({
        provider_tx_id: (remote as any).providerTransactionId ?? null,
        failure_code: (remote as any).failureReason?.failureCode ?? null,
        failure_message: (remote as any).failureReason?.failureMessage ?? null,
      })
      .eq('deposit_id', depositId);

    await this.applyDepositTerminal(dep, String(remote.status).toUpperCase());
    this.logger.log(`pawaPay callback vérifié — depositId=${depositId} status=${remote.status} kind=${dep.kind}`);
  }

  /**
   * Statut d'un dépôt re-lu À LA SOURCE. Essaie le compte PawaPay DU TENANT
   * (si configuré — c'est peut-être lui qui a initié le dépôt, cf. ppOverride
   * d'offering-checkout), puis le compte plateforme. Sans cet override, un dépôt
   * initié avec le token tenant restait invérifiable (client débité, accès
   * jamais accordé).
   */
  private async verifiedDepositStatus(depositId: string, tenantId: string | null) {
    if (tenantId) {
      try {
        const tp = await this.tenantPayments.resolveTenantProviderCreds(tenantId, 'pawapay');
        const token = (tp as any)?.creds?.api_token || null;
        if (token) {
          const viaTenant = await this.pawapay.getDepositStatus(depositId, {
            apiToken: token,
            baseUrl: this.pawapayBaseFromMode((tp as any)?.mode ?? null),
          });
          if (viaTenant?.status) return viaTenant;
        }
      } catch {
        /* repli plateforme */
      }
    }
    if (!this.pawapay.isConfigured) return null;
    return this.pawapay.getDepositStatus(depositId).catch(() => null);
  }

  private pawapayBaseFromMode(mode: string | null): string | undefined {
    const m = (mode ?? '').toLowerCase();
    if (m === 'sandbox' || m === 'test') return 'https://api.sandbox.pawapay.io';
    if (m === 'production' || m === 'live') return 'https://api.pawapay.io';
    return undefined;
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
      .select('key, label, price_cents, currency, billing_cycle')
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

    // Durée d'accès selon le cycle du plan (Mobile Money = paiement unique sans
    // période Stripe) : mensuel=30j, trimestriel=90j, annuel=365j.
    const cycle = String(plan.billing_cycle || 'monthly').toLowerCase();
    const periodDays =
      cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : SubscriptionRenewalService.PERIOD_DAYS;
    // Période : Stripe fournit la fin faisant foi ; sinon prolonge selon le cycle.
    const computedEnd =
      opts.currentPeriodEnd ??
      this.addDaysISO(
        existing?.current_period_end && new Date(existing.current_period_end) > now
          ? new Date(existing.current_period_end)
          : now,
        periodDays,
      );

    if (existing) {
      const patch: Record<string, unknown> = {
        status: 'active',
        current_period_end: computedEnd,
        updated_at: now.toISOString(),
      };
      if (opts.providerSubscriptionId) patch.provider_subscription_id = opts.providerSubscriptionId;
      if (opts.providerCustomerId) patch.provider_customer_id = opts.providerCustomerId;
      const { error: updErr } = await this.subs.update(patch).eq('id', existing.id);
      if (updErr) {
        this.logger.error(
          `Abonnement NON prolongé (update refusé) — user=${userId} plan=${planSlug} (${provider}): ${updErr.message}`,
        );
      } else {
        this.logger.log(`Abonnement prolongé — user=${userId} plan=${planSlug} (${provider}) → ${computedEnd}`);
      }
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
      const { error: insErr } = await this.subs.insert(row);
      if (insErr) {
        this.logger.error(
          `Abonnement NON créé (insert refusé) — user=${userId} plan=${planSlug} (${provider}): ${insErr.message}`,
        );
        return;
      }
      this.logger.log(`Abonnement créé — user=${userId} plan=${planSlug} (${provider}) → ${computedEnd}`);
    }

    // Vitrine douce : un abonnement actif accorde l'accès — membership tenant (idempotente) +
    // promotion visitor→student (jamais de downgrade). Sans ça, le contenu pédagogique RLS reste vide
    // et la garde élève ne s'ouvre pas. Tolérant aux erreurs (ne casse jamais le fulfillment).
    await this.grantStudentAccess(userId, tenantId);

    // Reçu : notification in-app + email de confirmation à l'élève (best-effort).
    await this.notifyStudentPayment(userId, tenantId, plan);
  }

  /**
   * Après un paiement actif : NOTIFIE l'élève (in-app + email reçu). Best-effort —
   * ne casse jamais le fulfillment. ⚠️ `notifications.type` et `priority` sont bornés
   * par CHECK → seules 'success'/'normal' sont acceptées (sinon UPDATE/INSERT rejeté
   * en silence — bug vécu 3× cette session sur provider/sync_status/type). L'email part
   * via `email_queue` (le worker l'envoie par Resend, expéditeur = `email_from` du tenant).
   */
  private async notifyStudentPayment(
    userId: string,
    tenantId: string,
    plan: { key: string; label?: string | null; price_cents?: number | null; currency?: string | null },
  ): Promise<void> {
    const planLabel = plan?.label || plan?.key || 'votre offre';
    const amount =
      plan?.price_cents != null
        ? `${(Number(plan.price_cents) / 100).toFixed(2)} ${plan.currency || 'EUR'}`
        : '';

    // 1) Notification in-app
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('notifications').insert({
        tenant_id: tenantId,
        user_id: userId,
        type: 'success',
        priority: 'normal',
        title: 'Paiement confirmé ✓',
        body: `Votre accès est activé. Merci pour votre paiement — ${planLabel}${amount ? ` (${amount})` : ''}.`,
        action_url: '/m/eleve',
        is_read: false,
        is_silent: false,
        sent_email: true,
      });
    } catch (e) {
      this.logger.warn(`notif paiement (user=${userId}): ${(e as Error).message}`);
    }

    // 2) Email reçu — adresse élève via auth admin ; expéditeur via tenant_notification_settings.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: u } = await (this.supabase as any).auth.admin.getUserById(userId);
      const to = u?.user?.email;
      if (!to) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ns } = await (this.supabase as any)
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('email_queue').insert({
        tenant_id: tenantId,
        to,
        from: ns?.email_from ?? null,
        from_name: ns?.email_from_name ?? null,
        subject: 'Paiement confirmé — votre accès est activé',
        html_body:
          `<h2>Merci pour votre paiement</h2>` +
          `<p>Votre paiement${amount ? ` de <strong>${amount}</strong>` : ''} pour « ${planLabel} » est confirmé.</p>` +
          `<p>Votre accès est désormais <strong>actif</strong> — connectez-vous pour accéder à vos contenus.</p>`,
        status: 'pending',
      });
    } catch (e) {
      this.logger.warn(`email reçu paiement (user=${userId}): ${(e as Error).message}`);
    }
  }

  /**
   * Reçu d'un paiement UNIQUE (don / offrande / consultation) — pas d'accès accordé,
   * juste une notif in-app + un email « merci/reçu » à l'élève. Best-effort. Mêmes
   * contraintes CHECK que notifyStudentPayment (type='success', priority='normal').
   */
  private async notifyOneOffPayment(
    userId?: string | null,
    tenantId?: string | null,
    kind?: string | null,
    amountCents?: number | null,
    currency?: string | null,
  ): Promise<void> {
    if (!userId || !tenantId) return;
    const k = String(kind || '').toLowerCase();
    const label =
      k === 'donation' ? 'votre don'
        : k === 'offering' ? 'votre offrande'
          : k === 'consultation' ? 'votre consultation'
            : 'votre paiement';
    const amount = amountCents != null ? `${(Number(amountCents) / 100).toFixed(2)} ${currency || 'EUR'}` : '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('notifications').insert({
        tenant_id: tenantId,
        user_id: userId,
        type: 'success',
        priority: 'normal',
        title: 'Paiement reçu ✓',
        body: `Merci ! Nous confirmons ${label}${amount ? ` (${amount})` : ''}.`,
        action_url: '/m/eleve',
        is_read: false,
        is_silent: false,
        sent_email: true,
      });
    } catch (e) {
      this.logger.warn(`notif don (user=${userId}): ${(e as Error).message}`);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: u } = await (this.supabase as any).auth.admin.getUserById(userId);
      const to = u?.user?.email;
      if (!to) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ns } = await (this.supabase as any)
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('email_queue').insert({
        tenant_id: tenantId,
        to,
        from: ns?.email_from ?? null,
        from_name: ns?.email_from_name ?? null,
        subject: 'Reçu de paiement',
        html_body:
          `<h2>Merci pour ${label}</h2>` +
          `<p>Nous confirmons la réception de ${label}${amount ? ` d'un montant de <strong>${amount}</strong>` : ''}.</p>` +
          `<p>Ceci tient lieu de reçu. Merci de votre soutien.</p>`,
        status: 'pending',
      });
    } catch (e) {
      this.logger.warn(`email don (user=${userId}): ${(e as Error).message}`);
    }
  }

  /**
   * Accorde l'accès élève après un paiement actif : pose une `tenant_memberships`
   * (rôle student, idempotente — n'écrase jamais un rôle supérieur déjà présent) et
   * promeut le rôle GLOBAL visitor→student. Best-effort : toute erreur est seulement loguée.
   */
  private async grantStudentAccess(userId: string, tenantId: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberships = (this.supabase as any).from('tenant_memberships');
      const { data: mem } = await memberships
        .select('id, role, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!mem) {
        await memberships.insert({
          tenant_id: tenantId,
          user_id: userId,
          role: 'student',
          status: 'active',
        });
      } else if (mem.status && mem.status !== 'active') {
        await memberships.update({ status: 'active' }).eq('id', mem.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (this.supabase as any)
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      const role = String(profile?.role || '').toLowerCase();
      if (!role || role === 'visitor') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.supabase as any).from('profiles').update({ role: 'student' }).eq('id', userId);
      }
    } catch (e) {
      this.logger.warn(`grantStudentAccess (user=${userId}): ${(e as Error).message}`);
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
        // Don / offrande / consultation : reçu (notif + email) sans octroi d'accès.
        await this.notifyOneOffPayment(userId, meta.tenant_id ?? null, meta.kind, session.amount_total ?? null, session.currency ?? null);
      }
      return;
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const invoice = event.data?.object ?? {};
      // La 1re facture est déjà couverte par checkout.session.completed → pas de double prolongation.
      if (invoice.billing_reason === 'subscription_create') return;
      // L'objet `invoice` a été restructuré selon la version d'API Stripe : on cherche l'ID
      // d'abonnement aux emplacements connus (legacy + 2024+/clover) pour rester robuste.
      const line0 = invoice.lines?.data?.[0] ?? {};
      const stripeSubId =
        invoice.subscription ??
        invoice.parent?.subscription_details?.subscription ??
        line0.parent?.subscription_item_details?.subscription ??
        line0.subscription ??
        null;
      if (!stripeSubId) {
        this.logger.warn('invoice.paid : aucun subscription id dans la facture (version API ?)');
        return;
      }
      const { data: sub } = await this.subs
        .select('id')
        .eq('provider_subscription_id', stripeSubId)
        .maybeSingle();
      if (!sub) {
        this.logger.warn(`invoice.paid : abonnement Stripe introuvable sub=${stripeSubId}`);
        return;
      }
      const periodEnd =
        unixToIso(line0.period?.end) ??
        unixToIso(invoice.period_end) ??
        this.addDaysISO(new Date(), SubscriptionRenewalService.PERIOD_DAYS);
      await this.subs
        .update({ status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
      this.logger.log(`Renouvellement Stripe — sub=${sub.id} → ${periodEnd}`);
      return;
    }
  }

  // ── Poller serveur des dépôts offering (callback indisponible, compte partagé) ──
  /**
   * Applique le statut distant d'un dépôt : met à jour, et sur COMPLETED (transition
   * ATOMIQUE anti-double via WHERE status != COMPLETED) active/prolonge l'abo si
   * kind=subscription. Idempotent — appelé par le poller ET par getStatus (front).
   */
  async applyDepositTerminal(
    dep: {
      deposit_id: string;
      user_id: string;
      kind?: string;
      plan_slug?: string | null;
      tenant_id?: string | null;
      pawapay_status?: string;
      amount_cents?: number | null;
      currency?: string | null;
    },
    remoteStatus: string,
  ): Promise<void> {
    if (!remoteStatus || remoteStatus === dep.pawapay_status) return;
    if (remoteStatus !== 'COMPLETED') {
      await this.ppDeposits.update({ pawapay_status: remoteStatus }).eq('deposit_id', dep.deposit_id);
      return;
    }
    // COMPLETED : un seul appelant gagne la transition (le 2e met à jour 0 ligne → skip).
    const { data: claimed } = await this.ppDeposits
      .update({ pawapay_status: 'COMPLETED' })
      .eq('deposit_id', dep.deposit_id)
      .neq('pawapay_status', 'COMPLETED')
      .select('deposit_id');
    if (!claimed || claimed.length === 0) return; // déjà traité ailleurs
    if (dep.kind === 'subscription' && dep.plan_slug) {
      await this.createOrExtendSubscription(dep.user_id, dep.plan_slug, {
        tenantId: dep.tenant_id ?? null,
        provider: 'pawapay',
      });
    } else {
      // Don / offrande / consultation : pas d'accès à ouvrir, juste un reçu
      // (notif + email). Le claim atomique ci-dessus garantit l'envoi UNIQUE
      // même si webhook et poller confirment le même dépôt.
      await this.notifyOneOffPayment(dep.user_id, dep.tenant_id ?? null, dep.kind, dep.amount_cents ?? undefined, dep.currency ?? undefined);
    }
  }

  /**
   * Interroge PawaPay pour chaque dépôt non terminal récent (48 h) et applique le statut.
   * Substitut du callback (qui part chez un autre tenant). Borné + tolérant aux erreurs.
   */
  async pollPendingOfferingDeposits(
    limit = 50,
  ): Promise<{ scanned: number; completed: number; failed: number }> {
    if (!this.pawapay.isConfigured) return { scanned: 0, completed: 0, failed: 0 };
    const floor = this.addDaysISO(new Date(), -2);
    const { data: pending } = await this.ppDeposits
      .select('deposit_id, user_id, kind, plan_slug, tenant_id, pawapay_status, amount_cents, currency')
      .in('pawapay_status', ['PENDING', 'ACCEPTED', 'SUBMITTED'])
      .gte('created_at', floor)
      .limit(limit);
    const rows: any[] = Array.isArray(pending) ? pending : [];
    let completed = 0;
    let failed = 0;
    for (const dep of rows) {
      try {
        // Re-lecture à la source avec les credentials qui ont pu initier le dépôt
        // (tenant d'abord, sinon plateforme) — sans ça, un dépôt initié sur le
        // compte tenant restait invérifiable à jamais.
        const remote = await this.verifiedDepositStatus(dep.deposit_id, dep.tenant_id ?? null);
        if (!remote?.status || remote.status === dep.pawapay_status) continue;
        await this.applyDepositTerminal(dep, remote.status);
        if (remote.status === 'COMPLETED') completed++;
        else if (remote.status === 'FAILED' || remote.status === 'REJECTED') failed++;
      } catch (e) {
        this.logger.warn(`poll dépôt ${dep.deposit_id}: ${(e as Error).message}`);
      }
    }
    if (rows.length) {
      this.logger.log(`poll offering: scanned=${rows.length} completed=${completed} failed=${failed}`);
    }
    return { scanned: rows.length, completed, failed };
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
            accountDetails: {
              phoneNumber: String(lastDep.phone_number ?? '').replace(/[^0-9]/g, ''),
              provider: lastDep.provider,
            },
          },
          customerMessage: 'PRORASCIENCE',
          // PawaPay v2 : metadata = tableau d'objets à UNE clé (nom = clé) ; on écarte les valeurs vides.
          metadata: ([
            { userId: String(sub.user_id ?? '') },
            { kind: 'subscription' },
            { planSlug: String(planSlug ?? '') },
          ] as Record<string, string>[]).filter(
            (m) => String(Object.values(m)[0] ?? '').length > 0,
          ),
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
