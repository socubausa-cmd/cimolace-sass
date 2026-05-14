/**
 * Payment Provider Interface — Multi-provider billing abstraction
 * Supports: Chariow, Stripe, CinetPay, NOWPayments, PayPal
 */
export type PaymentProviderType = 'stripe' | 'chariow' | 'cinetpay' | 'nowpayments' | 'paypal';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'trialing' | 'paused';

export interface CreateCheckoutInput {
  tenantId: string;
  userId: string;
  planId: string;
  priceCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  providerSessionId?: string;
}

export interface WebhookEvent {
  id: string;
  provider: PaymentProviderType;
  type: string;
  rawBody: string | Buffer;
  signature: string;
  headers: Record<string, string>;
}

export interface PaymentConfirmation {
  eventId: string;
  provider: PaymentProviderType;
  status: 'succeeded' | 'failed' | 'pending';
  amountCents: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPhoneCountry?: string;
  subscriptionId?: string;
  invoiceId?: string;
  providerTransactionId?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionInfo {
  id: string;
  tenantId: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  expiresAt?: string;
  provider: PaymentProviderType;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
}

export interface PaymentProvider {
  readonly type: PaymentProviderType;

  /** Create a checkout session / payment link */
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;

  /** Verify webhook signature and parse event */
  verifyWebhook(event: WebhookEvent): Promise<boolean>;

  /** Parse webhook payload into a normalized PaymentConfirmation */
  parseWebhookPayload(event: WebhookEvent): Promise<PaymentConfirmation | null>;

  /** Get subscription status from provider */
  getSubscription(providerSubscriptionId: string): Promise<{ status: SubscriptionStatus; currentPeriodEnd?: string }>;

  /** Cancel subscription at provider */
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}
