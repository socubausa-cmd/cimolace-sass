import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { PawaPayService } from '../pawapay/pawapay.service';
import { SupabaseService } from '../supabase/supabase.service';

// Stripe v22 — l'instance est le retour du constructeur
type StripeInstance = ReturnType<typeof Stripe>;

interface CheckoutSessionCompleted {
  metadata?: Record<string, string> | null;
  payment_intent?: string | null;
  payment_status?: string | null;
}

type CheckoutLive = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  tenant_id: string;
  status: string;
};

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private stripe: StripeInstance | null = null;
  private readonly stripeKey: string;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly pawapay: PawaPayService,
  ) {
    this.stripeKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    const configured = this.stripeKey && this.stripeKey !== 'replace_me';
    if (!configured) {
      this.logger.warn('STRIPE_SECRET_KEY non configuré — checkout désactivé');
    } else {
      this.stripe = new Stripe(this.stripeKey, {
        apiVersion: '2026-04-22.dahlia',
      });
    }
  }

  async createSession(
    userId: string,
    liveSessionId: string,
  ): Promise<{ checkoutUrl: string }> {
    const stripe = this.assertStripe();
    const live = await this.findPayableLive(liveSessionId);

    const { data: existing } = await this.supabase.client
      .from('access_passes')
      .select('id')
      .eq('user_id', userId)
      .eq('resource_type', 'live_session')
      .eq('resource_id', liveSessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing)
      throw new BadRequestException('Vous avez déjà accès à ce live');

    return this.createStripeCheckoutSession(
      stripe,
      live,
      { userId, liveSessionId, tenantId: live.tenant_id },
      `checkout-${userId}-${liveSessionId}`,
    );
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.webhookSecret || this.webhookSecret === 'replace_me') {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET non configuré',
      );
    }
    const stripe = this.assertStripe();

    let event: ReturnType<StripeInstance['webhooks']['constructEvent']>;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Signature webhook Stripe invalide');
    }

    const session = event.data.object as CheckoutSessionCompleted;

    switch (event.type) {
      case 'checkout.session.completed':
        // Pour les paiements différés, payment_status peut être 'unpaid' — on attend async_payment_succeeded
        if (session.payment_status !== 'paid') {
          this.logger.log(
            `checkout.session.completed — paiement différé en attente (payment_status=${session.payment_status})`,
          );
          return;
        }
        await this.onCheckoutCompleted(session);
        break;
      case 'checkout.session.async_payment_succeeded':
        await this.onAsyncPaymentSucceeded(session);
        break;
      case 'checkout.session.async_payment_failed':
        await this.onAsyncPaymentFailed(session);
        break;
      case 'checkout.session.expired':
        await this.onCheckoutExpired(session);
        break;
    }
  }

  private async onCheckoutCompleted(
    session: CheckoutSessionCompleted,
  ): Promise<void> {
    const { userId, liveSessionId, tenantId } = session.metadata ?? {};

    if (!userId || !liveSessionId || !tenantId) {
      this.logger.warn('checkout.session.completed sans metadata attendue');
      return;
    }

    // Vérifier que le tenant existe et est actif avant de créer l'accès
    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (!tenant) {
      this.logger.warn(
        `checkout.session.completed — tenant ${tenantId} inexistant ou inactif`,
      );
      return;
    }

    const { error: passError } = await this.supabase.client
      .from('access_passes')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          resource_type: 'live_session',
          resource_id: liveSessionId,
          payment_id: session.payment_intent ?? null,
          status: 'active',
        },
        {
          onConflict: 'tenant_id,user_id,resource_type,resource_id',
          ignoreDuplicates: true,
        },
      );

    if (passError) {
      this.logger.error('Erreur création access_pass', passError.message);
      // Propager l'erreur pour que Stripe retente le webhook (réponse 5xx)
      throw new Error(`Erreur DB access_pass: ${passError.message}`);
    }

    // Assure que l'étudiant a bien une tenant_membership (nécessaire pour TenantGuard)
    const { error: memberError } = await this.supabase.client
      .from('tenant_memberships')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          role: 'student',
          status: 'active',
        },
        { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
      );

    if (memberError) {
      this.logger.error('Erreur upsert tenant_membership', memberError.message);
      throw new Error(`Erreur DB tenant_membership: ${memberError.message}`);
    }

    this.logger.log(`Access pass créé — user=${userId} live=${liveSessionId}`);
  }

  private async findPayableLive(liveSessionId: string): Promise<CheckoutLive> {
    const { data: live, error } = await this.supabase.client
      .from('live_sessions')
      .select('id, title, price_cents, currency, tenant_id, status')
      .eq('id', liveSessionId)
      .single();

    if (error || !live) throw new NotFoundException('Live session introuvable');
    if (live.status === 'cancelled' || live.status === 'ended') {
      throw new BadRequestException("Ce live n'est plus disponible");
    }

    return live as CheckoutLive;
  }

  private async createStripeCheckoutSession(
    stripe: StripeInstance,
    live: CheckoutLive,
    metadata: Record<string, string>,
    idempotencyKey: string,
  ): Promise<{ checkoutUrl: string }> {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: live.currency.toLowerCase(),
              product_data: { name: live.title },
              unit_amount: live.price_cents,
            },
            quantity: 1,
          },
        ],
        metadata,
        success_url: `${this.frontendUrl}/lives/${live.id}/join?payment=success`,
        cancel_url: `${this.frontendUrl}/lives/${live.id}/join?payment=cancelled`,
      },
      { idempotencyKey },
    );

    if (!session.url)
      throw new Error("Stripe n'a pas retourné d'URL de paiement");
    return { checkoutUrl: session.url };
  }

  // Paiement différé confirmé (SEPA, virement…) — même résultat que completed
  private async onAsyncPaymentSucceeded(
    session: CheckoutSessionCompleted,
  ): Promise<void> {
    this.logger.log(
      'checkout.session.async_payment_succeeded — activation access pass',
    );
    await this.onCheckoutCompleted(session);
  }

  // Paiement différé échoué — annuler l'access_pass s'il a été créé en avance
  private async onAsyncPaymentFailed(
    session: CheckoutSessionCompleted,
  ): Promise<void> {
    const { userId, liveSessionId, tenantId } = session.metadata ?? {};
    if (!userId || !liveSessionId || !tenantId) {
      this.logger.warn('checkout.session.async_payment_failed sans metadata');
      return;
    }

    const { error } = await this.supabase.client
      .from('access_passes')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('resource_type', 'live_session')
      .eq('resource_id', liveSessionId);

    if (error) {
      this.logger.error(
        'Erreur annulation access_pass après échec paiement',
        error.message,
      );
    } else {
      this.logger.warn(
        `Paiement échoué — access_pass annulé user=${userId} live=${liveSessionId}`,
      );
    }
  }

  // Session expirée sans paiement — nettoyer un éventuel pass en statut pending
  private async onCheckoutExpired(
    session: CheckoutSessionCompleted,
  ): Promise<void> {
    const { userId, liveSessionId, tenantId } = session.metadata ?? {};
    if (!userId || !liveSessionId || !tenantId) return;

    await this.supabase.client
      .from('access_passes')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('resource_type', 'live_session')
      .eq('resource_id', liveSessionId)
      .eq('status', 'pending');

    this.logger.log(
      `Session expirée — pass pending nettoyé user=${userId} live=${liveSessionId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAWAPAY — Mobile Money (CMR, RWA, GHA, CIV, …)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Accès non-typé à la table pawapay_deposits (pas encore dans les types Supabase générés).
   * Même pattern que pay-engine.service.ts pour les tables hors-schéma.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ppDeposits() {
    return (this.supabase.client as any).from('pawapay_deposits');
  }

  /**
   * Initie un dépôt Mobile Money via pawaPay.
   * Stocke la transaction en DB AVANT l'appel API pour garantir l'idempotence.
   * Retourne { depositId, status: 'ACCEPTED' } — le frontend poll /status ou attend le callback.
   */
  async createPawaPaySession(
    userId: string,
    liveSessionId: string,
    phoneNumber: string,
    provider: string,
    country: string,
  ): Promise<{ depositId: string; status: string }> {
    const live = await this.findPayableLive(liveSessionId);

    // Vérifier qu'il n'y a pas déjà un access_pass actif
    const { data: existing } = await this.supabase.client
      .from('access_passes')
      .select('id')
      .eq('user_id', userId)
      .eq('resource_type', 'live_session')
      .eq('resource_id', liveSessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) throw new BadRequestException('Vous avez déjà accès à ce live');

    // Générer le depositId AVANT l'appel pawaPay (idempotence réseau)
    const depositId = randomUUID();
    const amountStr = String(Math.round(live.price_cents)); // pawaPay attend string sans décimales

    // Persister en DB comme point de vérité avant tout appel externe
    const { error: insertError } = await this.ppDeposits
      .insert({
        deposit_id: depositId,
        tenant_id: live.tenant_id,
        user_id: userId,
        live_session_id: liveSessionId,
        amount_cents: live.price_cents,
        currency: live.currency.toUpperCase(),
        provider,
        phone_number: phoneNumber,
        country: country.toUpperCase(),
        pawapay_status: 'PENDING',
      });

    if (insertError) {
      this.logger.error('Erreur insertion pawapay_deposit', insertError.message);
      throw new ServiceUnavailableException('Erreur interne — impossible d\'initier le paiement');
    }

    // Appel pawaPay
    const result = await this.pawapay.initiateDeposit({
      depositId,
      amount: amountStr,
      currency: live.currency.toUpperCase(),
      payer: { type: 'MMO', accountDetails: { phoneNumber, provider } },
      statementDescription: `ISNA ${live.title}`.slice(0, 22),
      metadata: {
        userId,
        liveSessionId,
        tenantId: live.tenant_id,
      },
    });

    // Mettre à jour le statut pawaPay (ACCEPTED ou rejet immédiat)
    await this.ppDeposits
      .update({ pawapay_status: result.status })
      .eq('deposit_id', depositId);

    if (result.status === 'DUPLICATE_IGNORED') {
      this.logger.warn(`pawaPay DUPLICATE_IGNORED pour depositId=${depositId}`);
    }

    return { depositId, status: result.status };
  }

  /**
   * Traite le callback pawaPay (webhook HTTP POST).
   * Appel par POST /checkout/webhook/pawapay.
   * Signature HMAC-SHA256 vérifiée si PAWAPAY_SIGNING_SECRET est configuré.
   */
  async handlePawaPayCallback(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    // Vérification de signature
    if (signature !== undefined) {
      const valid = this.pawapay.verifyCallbackSignature(rawBody, signature);
      if (!valid) {
        throw new BadRequestException('Signature callback pawaPay invalide');
      }
    }

    let payload: { depositId?: string; status?: string; providerTransactionId?: string; failureReason?: { failureCode?: string; failureMessage?: string }; metadata?: Record<string, string> };
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Payload pawaPay invalide (JSON malformé)');
    }

    const { depositId, status, providerTransactionId, failureReason, metadata } = payload;
    if (!depositId || !status) {
      this.logger.warn('Callback pawaPay sans depositId ou status', payload);
      return;
    }

    this.logger.log(`pawaPay callback — depositId=${depositId} status=${status}`);

    // Mettre à jour le statut en DB
    await this.ppDeposits
      .update({
        pawapay_status: status,
        provider_tx_id: providerTransactionId ?? null,
        failure_code: failureReason?.failureCode ?? null,
        failure_message: failureReason?.failureMessage ?? null,
      })
      .eq('deposit_id', depositId);

    switch (status) {
      case 'COMPLETED':
        await this.onPawaPayCompleted(depositId, providerTransactionId, metadata);
        break;
      case 'FAILED':
      case 'REJECTED':
      case 'TIMED_OUT':
        await this.onPawaPayFailed(depositId, status);
        break;
      // DUPLICATE_IGNORED et ACCEPTED ne déclenchent pas d'action business
      default:
        this.logger.log(`pawaPay status intermédiaire ignoré: ${status}`);
    }
  }

  /**
   * Polling manuel du statut d'un dépôt pawaPay.
   * Utile si le callback n'est pas encore configuré (dev).
   */
  async pollPawaPayStatus(
    depositId: string,
    userId: string,
  ): Promise<{ depositId: string; status: string; isCompleted: boolean }> {
    // Vérifier que le dépôt appartient bien à cet utilisateur
    const { data: deposit } = await this.ppDeposits
      .select('deposit_id, user_id, live_session_id, tenant_id, pawapay_status')
      .eq('deposit_id', depositId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!deposit) throw new NotFoundException('Dépôt introuvable');

    // Si déjà complété en DB, pas besoin d'appeler pawaPay
    if (deposit.pawapay_status === 'COMPLETED') {
      return { depositId, status: 'COMPLETED', isCompleted: true };
    }

    // Appel pawaPay pour statut frais
    const remote = await this.pawapay.getDepositStatus(depositId);
    if (!remote) {
      return { depositId, status: deposit.pawapay_status, isCompleted: false };
    }

    // Synchroniser si status a changé
    if (remote.status !== deposit.pawapay_status) {
      await this.handlePawaPayCallback(
        Buffer.from(JSON.stringify(remote)),
        undefined, // pas de signature sur le polling
      );
    }

    return {
      depositId,
      status: remote.status,
      isCompleted: remote.status === 'COMPLETED',
    };
  }

  /** Récupère les providers Mobile Money disponibles via pawaPay */
  async getPawaPayProviders(country?: string) {
    return this.pawapay.getActiveConfig(country);
  }

  private async onPawaPayCompleted(
    depositId: string,
    providerTxId?: string,
    metadata?: Record<string, string>,
  ): Promise<void> {
    // Récupérer les infos du dépôt depuis notre DB
    const { data: deposit } = await this.ppDeposits
      .select('tenant_id, user_id, live_session_id, amount_cents, currency')
      .eq('deposit_id', depositId)
      .maybeSingle();

    if (!deposit) {
      this.logger.warn(`COMPLETED pour depositId inconnu: ${depositId}`);
      return;
    }

    const { tenant_id: tenantId, user_id: userId, live_session_id: liveSessionId } = deposit;

    // Vérifier que le tenant est actif
    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (!tenant) {
      this.logger.warn(`pawaPay COMPLETED — tenant ${tenantId} inexistant/inactif`);
      return;
    }

    const { error: passError } = await this.supabase.client
      .from('access_passes')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          resource_type: 'live_session',
          resource_id: liveSessionId,
          payment_id: `pawapay:${depositId}${providerTxId ? `:${providerTxId}` : ''}`,
          status: 'active',
        },
        {
          onConflict: 'tenant_id,user_id,resource_type,resource_id',
          ignoreDuplicates: true,
        },
      );

    if (passError) {
      this.logger.error('pawaPay: erreur création access_pass', passError.message);
      throw new Error(`Erreur DB access_pass pawaPay: ${passError.message}`);
    }

    const { error: memberError } = await this.supabase.client
      .from('tenant_memberships')
      .upsert(
        { tenant_id: tenantId, user_id: userId, role: 'student', status: 'active' },
        { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
      );

    if (memberError) {
      this.logger.error('pawaPay: erreur upsert tenant_membership', memberError.message);
      throw new Error(`Erreur DB membership pawaPay: ${memberError.message}`);
    }

    this.logger.log(
      `pawaPay COMPLETED — access_pass créé user=${userId} live=${liveSessionId}`,
    );
  }

  private async onPawaPayFailed(depositId: string, status: string): Promise<void> {
    this.logger.warn(`pawaPay ${status} — depositId=${depositId}`);
    // Rien d'autre à faire : pas d'access_pass créé en avance pour pawaPay
  }

  // ─────────────────────────────────────────────────────────────────────────

  private assertStripe(): StripeInstance {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Service Stripe non configuré (STRIPE_SECRET_KEY)',
      );
    }
    return this.stripe;
  }
}
