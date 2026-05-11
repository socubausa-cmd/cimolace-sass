import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
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

  private assertStripe(): StripeInstance {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Service Stripe non configuré (STRIPE_SECRET_KEY)',
      );
    }
    return this.stripe;
  }
}
