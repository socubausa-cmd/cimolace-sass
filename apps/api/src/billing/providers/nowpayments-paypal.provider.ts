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
export class NowPaymentsProvider implements PaymentProvider {
  readonly type = 'nowpayments' as const;
  private readonly logger = new Logger(NowPaymentsProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.nowpayments.io/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('NOWPAYMENTS_API_KEY') ?? '';
    this.webhookSecret = config.get<string>('NOWPAYMENTS_IPN_SECRET') ?? '';
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.apiKey) throw new Error('NOWPayments API key not configured');
    const res = await fetch(`${this.baseUrl}/invoice`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: input.priceCents / 100,
        price_currency: input.currency || 'usd',
        order_id: `sub_${input.tenantId}_${Date.now()}`,
        order_description: `Abonnement ${input.planId}`,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    });
    if (!res.ok) throw new Error(`NOWPayments error ${res.status}`);
    const data: any = await res.json();
    return {
      checkoutUrl: data.invoice_url,
      sessionId: data.id,
      providerSessionId: data.id,
    };
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    if (!this.webhookSecret) return true;
    const expected = createHmac('sha512', this.webhookSecret)
      .update(
        typeof event.rawBody === 'string'
          ? event.rawBody
          : event.rawBody.toString(),
      )
      .digest('hex');
    return expected === (event.headers['x-nowpayments-sig'] || '');
  }

  async parseWebhookPayload(
    event: WebhookEvent,
  ): Promise<PaymentConfirmation | null> {
    try {
      const p =
        typeof event.rawBody === 'string'
          ? JSON.parse(event.rawBody)
          : JSON.parse(event.rawBody.toString());
      return {
        eventId: event.id,
        provider: 'nowpayments',
        status:
          p.payment_status === 'finished'
            ? 'succeeded'
            : p.payment_status === 'failed'
              ? 'failed'
              : 'pending',
        amountCents: Math.round(Number(p.price_amount || 0) * 100),
        currency: (p.price_currency || 'usd').toUpperCase(),
        providerTransactionId: p.payment_id,
      };
    } catch {
      return null;
    }
  }

  async getSubscription(_id: string): Promise<{ status: SubscriptionStatus }> {
    return { status: 'active' };
  }
  async cancelSubscription(_id: string): Promise<void> {}
}

@Injectable()
export class PayPalProvider implements PaymentProvider {
  readonly type = 'paypal' as const;
  private readonly logger = new Logger(PayPalProvider.name);
  private readonly clientId: string;
  private readonly secret: string;
  private readonly baseUrl = 'https://api-m.paypal.com';

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get<string>('PAYPAL_CLIENT_ID') ?? '';
    this.secret = config.get<string>('PAYPAL_SECRET') ?? '';
  }

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    const data: any = await res.json();
    return data.access_token;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.clientId) throw new Error('PayPal not configured');
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: (input.currency || 'USD').toUpperCase(),
              value: String(input.priceCents / 100),
            },
          },
        ],
        application_context: {
          return_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
      }),
    });
    const data: any = await res.json();
    const url = data.links?.find((l: any) => l.rel === 'approve')?.href || '';
    return { checkoutUrl: url, sessionId: data.id, providerSessionId: data.id };
  }

  async verifyWebhook(_event: WebhookEvent): Promise<boolean> {
    return true;
  }

  async parseWebhookPayload(
    event: WebhookEvent,
  ): Promise<PaymentConfirmation | null> {
    try {
      const p =
        typeof event.rawBody === 'string'
          ? JSON.parse(event.rawBody)
          : JSON.parse(event.rawBody.toString());
      return {
        eventId: event.id,
        provider: 'paypal',
        status: p.resource?.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amountCents: Math.round(Number(p.resource?.amount?.value || 0) * 100),
        currency: (p.resource?.amount?.currency_code || 'USD').toUpperCase(),
        providerTransactionId: p.resource?.id,
      };
    } catch {
      return null;
    }
  }

  async getSubscription(_id: string): Promise<{ status: SubscriptionStatus }> {
    return { status: 'active' };
  }
  async cancelSubscription(_id: string): Promise<void> {}
}
