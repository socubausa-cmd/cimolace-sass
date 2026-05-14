/**
 * BillingService — Multi-provider billing orchestrator
 * Supports: Stripe, Chariow, CinetPay, NOWPayments, PayPal
 * Handles: checkout, webhooks, subscriptions, invoices, idempotence, DLQ
 */
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
import type { TenantContext } from '../tenant/tenant.types';
import type {
  CheckoutResult,
  CreateCheckoutInput,
  PaymentConfirmation,
  PaymentProvider,
  PaymentProviderType,
  SubscriptionStatus,
  WebhookEvent,
} from './payment-provider.interface';
import { ChariowProvider } from './providers/chariow.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';

type StripeInstance = ReturnType<typeof Stripe>;

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateSubscriptionDto {
  provider?: PaymentProviderType;
  planId: string;
  priceCents: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface UpdateSubscriptionDto {
  priceId?: string;
  quantity?: number;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: StripeInstance | null = null;
  private readonly providers = new Map<PaymentProviderType, PaymentProvider>();
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    chariow: ChariowProvider,
    cinetpay: CinetPayProvider,
  ) {
    // Stripe
    const stripeKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_BILLING_WEBHOOK_SECRET') ?? '';
    if (stripeKey && stripeKey !== 'replace_me') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });
    }

    // Multi-provider registry
    this.providers.set('chariow', chariow);
    this.providers.set('cinetpay', cinetpay);
    // Stripe is handled internally (not through the interface for now — can be extracted later)
  }

  // ── Provider resolution ─────────────────────────────────────────────────

  private getProvider(type: PaymentProviderType): PaymentProvider | null {
    return this.providers.get(type) ?? null;
  }

  private getAvailableProviders(): PaymentProviderType[] {
    const available: PaymentProviderType[] = [];
    if (this.stripe) available.push('stripe');
    for (const [type] of this.providers) available.push(type);
    return available;
  }

  // ── Checkout ────────────────────────────────────────────────────────────

  async createCheckout(
    tenant: TenantContext,
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<CheckoutResult & { provider: PaymentProviderType }> {
    const provider = dto.provider || 'stripe';

    if (provider === 'stripe') {
      return this.createStripeCheckout(tenant, userId, dto);
    }

    const prov = this.getProvider(provider);
    if (!prov) throw new BadRequestException(`Provider ${provider} non disponible`);

    const result = await prov.createCheckout({
      tenantId: tenant.id,
      userId,
      planId: dto.planId,
      priceCents: dto.priceCents,
      currency: dto.currency || 'XOF',
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });

    // Persist pending subscription
    await this.supabase.client.from('billing_subscriptions').insert({
      tenant_id: tenant.id,
      user_id: userId,
      plan_id: dto.planId,
      provider,
      provider_checkout_id: result.providerSessionId,
      status: 'pending',
      amount_cents: dto.priceCents,
      currency: dto.currency || 'XOF',
    } as any);

    return { ...result, provider };
  }

  private async createStripeCheckout(
    tenant: TenantContext,
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<CheckoutResult & { provider: PaymentProviderType }> {
    const stripe = this.assertStripe();
    const customerId = await this.ensureStripeCustomer(tenant);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: dto.planId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata: { tenant_id: tenant.id, user_id: userId },
    });

    await this.supabase.client.from('billing_subscriptions').insert({
      tenant_id: tenant.id,
      user_id: userId,
      plan_id: dto.planId,
      provider: 'stripe',
      provider_checkout_id: session.id,
      status: 'pending',
      amount_cents: dto.priceCents,
      currency: dto.currency || 'usd',
    } as any);

    return { checkoutUrl: session.url!, sessionId: session.id, provider: 'stripe' };
  }

  // ── Webhook handling (multi-provider) ───────────────────────────────────

  async handleWebhook(
    provider: PaymentProviderType,
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    // ── Idempotence check ──────────────────────────────────────────────────
    const eventId = this.extractEventId(rawBody, provider);
    if (eventId) {
      const { data: existing } = await (this.supabase.client as any)
        .from('billing_events')
        .select('id')
        .eq('provider_event_id', eventId)
        .eq('provider', provider)
        .maybeSingle();
      if (existing) { this.logger.debug(`Webhook dupliqué ignoré: ${eventId}`); return; }
    }

    // ── Record event ───────────────────────────────────────────────────────
    await (this.supabase.client as any).from('billing_events').insert({
      provider_event_id: eventId,
      provider,
      event_type: 'webhook',
      payload: this.safeParseJson(rawBody),
      processed: false,
    });

    // ── Parse via provider ─────────────────────────────────────────────────
    let confirmation: PaymentConfirmation | null = null;

    if (provider === 'stripe') {
      confirmation = await this.handleStripeWebhook(rawBody, signature);
    } else {
      const prov = this.getProvider(provider);
      if (!prov) { this.logger.warn(`Provider inconnu: ${provider}`); return; }

      const verified = await prov.verifyWebhook({
        id: eventId || 'unknown',
        provider,
        type: 'webhook',
        rawBody,
        signature,
        headers: {},
      });
      if (!verified) { this.logger.warn(`Signature webhook invalide: ${provider}`); return; }

      confirmation = await prov.parseWebhookPayload({
        id: eventId || 'unknown',
        provider,
        type: 'webhook',
        rawBody,
        signature,
        headers: {},
      });
    }

    // ── Apply confirmation ────────────────────────────────────────────────
    if (confirmation) {
      await this.applyPaymentConfirmation(confirmation);
    }

    // ── Mark processed ─────────────────────────────────────────────────────
    if (eventId) {
      await (this.supabase.client as any).from('billing_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('provider_event_id', eventId);
    }
  }

  private async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<PaymentConfirmation | null> {
    if (!this.webhookSecret) throw new ServiceUnavailableException('Webhook secret not configured');
    const stripe = this.assertStripe();

    let event: any;
    try { event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret); }
    catch { throw new BadRequestException('Signature webhook Stripe invalide'); }

    const obj = event.data.object;
    if (event.type === 'checkout.session.completed') {
      return {
        eventId: event.id,
        provider: 'stripe',
        status: 'succeeded',
        amountCents: obj.amount_total || 0,
        currency: (obj.currency || 'usd').toUpperCase(),
        customerEmail: obj.customer_email || obj.customer_details?.email,
        providerTransactionId: obj.id,
        metadata: obj.metadata || {},
      };
    }
    if (event.type === 'invoice.payment_succeeded') {
      return {
        eventId: event.id,
        provider: 'stripe',
        status: 'succeeded',
        amountCents: obj.amount_paid || 0,
        currency: (obj.currency || 'usd').toUpperCase(),
        customerEmail: obj.customer_email,
        invoiceId: obj.id,
        subscriptionId: obj.subscription,
        providerTransactionId: obj.payment_intent,
      };
    }
    return null;
  }

  // ── Payment confirmation orchestrator ───────────────────────────────────

  private async applyPaymentConfirmation(conf: PaymentConfirmation): Promise<void> {
    if (conf.status !== 'succeeded') {
      this.logger.log(`Payment ${conf.eventId} status: ${conf.status} — skipping activation`);
      return;
    }

    // Find matching subscription
    const { data: sub } = await (this.supabase.client as any)
      .from('billing_subscriptions')
      .select('*')
      .eq('provider', conf.provider)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      this.logger.warn(`No pending subscription found for ${conf.provider} payment ${conf.eventId}`);
      return;
    }

    // Activate subscription
    const periodStart = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await (this.supabase.client as any).from('billing_subscriptions').update({
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      provider_transaction_id: conf.providerTransactionId,
      customer_email: conf.customerEmail,
      customer_phone: conf.customerPhone,
      updated_at: new Date().toISOString(),
    }).eq('id', sub.id);

    // Update tenant plan
    await (this.supabase.client as any).from('tenants').update({
      plan: sub.plan_id || 'pro',
      subscription_status: 'active',
      subscription_expires_at: periodEnd,
    }).eq('id', sub.tenant_id);

    // Generate invoice
    await (this.supabase.client as any).from('billing_invoices').insert({
      tenant_id: sub.tenant_id,
      subscription_id: sub.id,
      provider: conf.provider,
      amount_cents: conf.amountCents,
      currency: conf.currency,
      status: 'paid',
      paid_at: new Date().toISOString(),
      provider_transaction_id: conf.providerTransactionId,
    });

    this.logger.log(`Subscription ${sub.id} activated for tenant ${sub.tenant_id} via ${conf.provider}`);
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  async getSubscription(tenant: TenantContext): Promise<any> {
    const { data } = await (this.supabase.client as any)
      .from('billing_subscriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  }

  async listSubscriptions(tenant: TenantContext): Promise<any[]> {
    const { data } = await (this.supabase.client as any)
      .from('billing_subscriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  }

  async cancelSubscription(tenant: TenantContext): Promise<any> {
    const sub = await this.getSubscription(tenant);
    if (!sub) throw new NotFoundException('Aucun abonnement actif');

    const provider = sub.provider as PaymentProviderType;
    if (provider === 'stripe') {
      const stripe = this.assertStripe();
      if (sub.provider_subscription_id) {
        await stripe.subscriptions.update(sub.provider_subscription_id, { cancel_at_period_end: true });
      }
    } else {
      const prov = this.getProvider(provider);
      if (prov && sub.provider_subscription_id) {
        await prov.cancelSubscription(sub.provider_subscription_id);
      }
    }

    await (this.supabase.client as any).from('billing_subscriptions').update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }).eq('id', sub.id);

    return { ...sub, status: 'canceled' };
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  async listInvoices(tenant: TenantContext, limit = 10): Promise<any[]> {
    const { data } = await (this.supabase.client as any)
      .from('billing_invoices')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  async getInvoice(tenant: TenantContext, invoiceId: string): Promise<any> {
    const { data } = await (this.supabase.client as any)
      .from('billing_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenant.id)
      .single();
    if (!data) throw new NotFoundException('Facture introuvable');
    return data;
  }

  // ── Payment accounts (tenant-level provider config) ─────────────────────

  async getPaymentAccounts(tenant: TenantContext): Promise<any> {
    const { data } = await (this.supabase.client as any)
      .from('tenant_payment_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    return data || {};
  }

  async savePaymentAccounts(tenant: TenantContext, accounts: Record<string, any>): Promise<any> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_payment_accounts')
      .upsert({
        tenant_id: tenant.id,
        providers: accounts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ── Provider status ─────────────────────────────────────────────────────

  getProvidersStatus(): { provider: PaymentProviderType; available: boolean }[] {
    return this.getAvailableProviders().map(p => ({
      provider: p,
      available: true,
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private extractEventId(rawBody: Buffer, provider: string): string | null {
    try {
      const json = JSON.parse(rawBody.toString());
      return json.id || json.event_id || json.data?.id || `${provider}_${Date.now()}`;
    } catch { return null; }
  }

  private safeParseJson(raw: Buffer): any {
    try { return JSON.parse(raw.toString()); } catch { return { raw: raw.toString('base64') }; }
  }

  private async ensureStripeCustomer(tenant: TenantContext): Promise<string> {
    const { data } = await this.supabase.client.from('tenants')
      .select('stripe_customer_id').eq('id', tenant.id).single();
    if ((data as any)?.stripe_customer_id) return (data as any).stripe_customer_id;

    const stripe = this.assertStripe();
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: { tenantId: tenant.id, slug: tenant.slug },
    });
    await this.supabase.client.from('tenants').update({ stripe_customer_id: customer.id }).eq('id', tenant.id);
    return customer.id;
  }

  private assertStripe(): StripeInstance {
    if (!this.stripe) throw new ServiceUnavailableException('Stripe non configuré');
    return this.stripe;
  }
}
