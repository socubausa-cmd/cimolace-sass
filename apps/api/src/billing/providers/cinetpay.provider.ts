/**
 * CinetPay Payment Provider — Mobile Money (Orange Money, MTN Money, Moov Money)
 * Used primarily in West and Central Africa
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
export class CinetPayProvider implements PaymentProvider {
  readonly type = 'cinetpay' as const;
  private readonly logger = new Logger(CinetPayProvider.name);
  private readonly apiKey: string;
  private readonly siteId: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api-checkout.cinetpay.com/v2';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('CINETPAY_API_KEY') ?? '';
    this.siteId = config.get<string>('CINETPAY_SITE_ID') ?? '';
    this.webhookSecret = config.get<string>('CINETPAY_WEBHOOK_SECRET') ?? '';
    if (!this.apiKey || this.apiKey === 'replace_me') {
      this.logger.warn('CINETPAY_API_KEY non configuré — CinetPay désactivé');
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.apiKey) throw new Error('CinetPay API key not configured');

    const transactionId = `cinet_${input.tenantId.slice(0, 8)}_${Date.now()}`;
    const body = {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: transactionId,
      amount: Math.round(input.priceCents),
      currency: input.currency || 'XOF',
      description: `Abonnement ${input.planId}`,
      customer_name: input.metadata?.customerName || 'Client',
      customer_email: input.metadata?.customerEmail || '',
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      notify_url: `${process.env.API_URL || 'http://localhost:4000'}/billing/webhook/cinetpay`,
      metadata: JSON.stringify({
        tenant_id: input.tenantId,
        user_id: input.userId,
        plan_id: input.planId,
      }),
    };

    const res = await fetch(`${this.baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`CinetPay checkout error: ${err}`);
      throw new Error(`CinetPay checkout failed: ${res.status}`);
    }

    const data: any = await res.json();
    return {
      checkoutUrl: data.data?.payment_url || data.payment_url,
      sessionId: transactionId,
      providerSessionId: data.data?.payment_token || data.payment_token,
    };
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    if (!this.webhookSecret || this.webhookSecret === 'replace_me') return true;
    if (!event.signature) return false;

    const expected = createHmac('sha256', this.webhookSecret)
      .update(
        typeof event.rawBody === 'string'
          ? event.rawBody
          : event.rawBody.toString(),
      )
      .digest('hex');

    return expected === event.signature.replace(/^sha256=/i, '').trim();
  }

  async parseWebhookPayload(
    event: WebhookEvent,
  ): Promise<PaymentConfirmation | null> {
    try {
      const payload =
        typeof event.rawBody === 'string'
          ? JSON.parse(event.rawBody)
          : JSON.parse(event.rawBody.toString());

      const status = this.mapStatus(payload.status || payload.cpm_trans_status);

      let meta: Record<string, string> = {};
      try {
        meta =
          typeof payload.metadata === 'string'
            ? JSON.parse(payload.metadata)
            : payload.metadata || {};
      } catch {
        /* ignore */
      }

      return {
        eventId: event.id,
        provider: 'cinetpay',
        status,
        amountCents: Math.round(
          Number(payload.amount || payload.cpm_amount || 0),
        ),
        currency: (
          payload.currency ||
          payload.cpm_currency ||
          'XOF'
        ).toUpperCase(),
        customerEmail: payload.customer_email || null,
        customerPhone:
          payload.customer_phone_number || payload.cel_phone_num || null,
        providerTransactionId: payload.cpm_trans_id || payload.transaction_id,
        metadata: meta,
      };
    } catch (e: any) {
      this.logger.error(`CinetPay webhook parse error: ${e.message}`);
      return null;
    }
  }

  async getSubscription(
    _id: string,
  ): Promise<{ status: SubscriptionStatus; currentPeriodEnd?: string }> {
    return { status: 'active' };
  }

  async cancelSubscription(_id: string): Promise<void> {
    this.logger.warn('CinetPay cancel not supported — manage manually');
  }

  private mapStatus(status: string): PaymentConfirmation['status'] {
    const s = String(status || '').toLowerCase();
    if (
      [
        'success',
        'succeeded',
        'completed',
        'accepted',
        '00',
        'successful',
      ].includes(s)
    )
      return 'succeeded';
    if (['failed', 'cancelled', 'canceled', 'refused', 'error'].includes(s))
      return 'failed';
    return 'pending';
  }
}
