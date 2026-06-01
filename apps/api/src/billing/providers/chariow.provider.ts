/**
 * Chariow Payment Provider — Mobile Money (Orange, MTN, Moov) via Chariow API
 * Used primarily in Gabon and Francophone Africa
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type {
  CheckoutResult,
  CreateCheckoutInput,
  PaymentConfirmation,
  PaymentProvider,
  SubscriptionStatus,
  WebhookEvent,
} from '../payment-provider.interface';

@Injectable()
export class ChariowProvider implements PaymentProvider {
  readonly type = 'chariow' as const;
  private readonly logger = new Logger(ChariowProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.chariow.com/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('CHARIOW_API_KEY') ?? '';
    this.webhookSecret = config.get<string>('CHARIOW_WEBHOOK_SECRET') ?? '';
    if (!this.apiKey || this.apiKey === 'replace_me') {
      this.logger.warn('CHARIOW_API_KEY non configuré — Chariow désactivé');
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.apiKey) throw new Error('Chariow API key not configured');

    const body = {
      amount: Math.round(input.priceCents),
      currency: input.currency || 'XAF',
      description: `Abonnement ${input.planId}`,
      external_id: `sub_${input.tenantId}_${Date.now()}`,
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenant_id: input.tenantId,
        user_id: input.userId,
        plan_id: input.planId,
        ...input.metadata,
      },
    };

    const res = await fetch(`${this.baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Chariow checkout error: ${err}`);
      throw new Error(`Chariow checkout failed: ${res.status}`);
    }

    const data: any = await res.json();
    return {
      checkoutUrl: data.checkout_url || data.payment_url,
      sessionId: `chariow_${data.id || Date.now()}`,
      providerSessionId: data.id,
    };
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    if (!this.webhookSecret || this.webhookSecret === 'replace_me') return true; // Skip verification if not configured
    if (!event.signature) return false;

    const expected = createHmac('sha256', this.webhookSecret)
      .update(
        typeof event.rawBody === 'string'
          ? event.rawBody
          : event.rawBody.toString(),
      )
      .digest('hex');

    const cleanSig = event.signature.replace(/^sha256=/i, '').trim();
    try {
      return (
        createHmac('sha256', this.webhookSecret)
          .update(expected)
          .digest('hex') ===
        createHmac('sha256', this.webhookSecret).update(cleanSig).digest('hex')
      );
    } catch {
      return false;
    }
  }

  async parseWebhookPayload(
    event: WebhookEvent,
  ): Promise<PaymentConfirmation | null> {
    try {
      const payload =
        typeof event.rawBody === 'string'
          ? JSON.parse(event.rawBody)
          : JSON.parse(event.rawBody.toString());

      const data = payload.data || payload;
      const sale = data.sale || data;
      const status = this.mapStatus(
        sale?.status || data?.status || payload?.status,
      );

      return {
        eventId: event.id,
        provider: 'chariow',
        status,
        amountCents: Math.round(Number(sale?.amount || data?.amount || 0)),
        currency: (sale?.currency || data?.currency || 'XAF').toUpperCase(),
        customerEmail: sale?.customer?.email || data?.customer?.email || null,
        customerPhone:
          sale?.customer?.phone?.number || data?.customer?.phone || null,
        customerPhoneCountry: sale?.customer?.phone?.country_code || null,
        providerTransactionId: sale?.id || data?.id || payload?.id,
        metadata: {
          product_id: sale?.product?.id || data?.product?.id,
          external_id: data?.external_id || payload?.external_id,
        },
      };
    } catch (e: any) {
      this.logger.error(`Chariow webhook parse error: ${e.message}`);
      return null;
    }
  }

  async getSubscription(
    _providerSubscriptionId: string,
  ): Promise<{ status: SubscriptionStatus; currentPeriodEnd?: string }> {
    // Chariow doesn't have a subscription API - status comes from webhooks
    return { status: 'active' };
  }

  async cancelSubscription(_providerSubscriptionId: string): Promise<void> {
    // Chariow doesn't support subscription cancellation via API
    this.logger.warn('Chariow cancel not supported — manage manually');
  }

  private mapStatus(status: string): PaymentConfirmation['status'] {
    const s = String(status || '').toLowerCase();
    if (['completed', 'success', 'succeeded', 'paid', 'confirmed'].includes(s))
      return 'succeeded';
    if (['failed', 'cancelled', 'canceled', 'expired', 'refused'].includes(s))
      return 'failed';
    return 'pending';
  }
}
