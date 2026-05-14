/**
 * BillingService unit tests
 *
 * Strategy: avoid jest.mock('stripe') top-level (crashes ts-jest w/ TS 5.8).
 * Instead we inject a plain mock object directly into the private `stripe`
 * property of BillingService after construction.
 */

import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { SupabaseService } from '../supabase/supabase.service';

// ── Supabase chain helper ──────────────────────────────────────────────────────
function makeChain(data: unknown, error: unknown = null) {
  const q: any = {
    select: jest.fn(() => q),
    delete: jest.fn(() => q),
    eq: jest.fn(() => q),
    single: jest.fn(() => Promise.resolve({ data, error })),
    then: (resolve: (v: any) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  q.insert = jest.fn(() => Promise.resolve({ data, error }));
  q.update = jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ data, error })),
  }));
  return q;
}

// ── Stripe mock factory ────────────────────────────────────────────────────────
function makeStripe() {
  return {
    subscriptions: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentMethods: { attach: jest.fn() },
    invoices: { list: jest.fn(), retrieve: jest.fn() },
    billingPortal: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  };
}

// ── Service factory ────────────────────────────────────────────────────────────
function makeService(
  opts: {
    stripeKey?: string;
    webhookSecret?: string;
    fromFn?: jest.Mock;
  } = {},
) {
  const {
    stripeKey = 'sk_test_real',
    webhookSecret = 'whsec_test',
    fromFn = jest.fn(),
  } = opts;

  const config = {
    get: (key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return stripeKey;
      if (key === 'STRIPE_BILLING_WEBHOOK_SECRET') return webhookSecret;
      return undefined;
    },
  } as unknown as ConfigService;

  const supabase = {
    client: { from: fromFn },
  } as unknown as SupabaseService;

  const svc = new BillingService(config, supabase);
  return { svc, supabase, fromFn };
}

// ── Tenant ─────────────────────────────────────────────────────────────────────
const tenant = { id: 'tenant-1', name: 'Test Org', slug: 'test-org' } as any;

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('BillingService', () => {
  // ── Stripe non configuré ───────────────────────────────────────────────────
  describe('Stripe not configured', () => {
    it('throws ServiceUnavailableException on getSubscription', async () => {
      const { svc } = makeService({ stripeKey: 'replace_me' });
      await expect(svc.getSubscription(tenant)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on createSubscription', async () => {
      const { svc } = makeService({ stripeKey: 'replace_me' });
      await expect(
        svc.createSubscription(tenant, { priceId: 'price_123' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ── getSubscription ────────────────────────────────────────────────────────
  describe('getSubscription', () => {
    it('returns null when no Stripe customer', async () => {
      const fromFn = jest.fn(() => makeChain({ stripe_customer_id: null }));
      const { svc } = makeService({ fromFn });
      expect(await svc.getSubscription(tenant)).toBeNull();
    });

    it('returns first subscription when customer exists', async () => {
      const fakeSub = { id: 'sub_abc', status: 'active' };
      const fromFn = jest.fn(() => makeChain({ stripe_customer_id: 'cus_123' }));
      const { svc } = makeService({ fromFn });
      const stripe = makeStripe();
      stripe.subscriptions.list.mockResolvedValue({ data: [fakeSub] });
      (svc as any).stripe = stripe;
      expect(await svc.getSubscription(tenant)).toEqual(fakeSub);
    });
  });

  // ── createSubscription ─────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('creates a Stripe subscription with existing customer', async () => {
      const fromFn = jest.fn(() => makeChain({ stripe_customer_id: 'cus_123' }));
      const { svc } = makeService({ fromFn });
      const stripe = makeStripe();
      const fakeSub = { id: 'sub_new', status: 'incomplete' };
      stripe.subscriptions.create.mockResolvedValue(fakeSub);
      (svc as any).stripe = stripe;

      const result = await svc.createSubscription(tenant, { priceId: 'price_pro' });
      expect(stripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_123' }),
      );
      expect(result).toEqual(fakeSub);
    });
  });

  // ── cancelSubscription ─────────────────────────────────────────────────────
  describe('cancelSubscription', () => {
    it('schedules cancellation at period end', async () => {
      const fromFn = jest.fn(() => makeChain({ stripe_customer_id: 'cus_123' }));
      const { svc } = makeService({ fromFn });
      const stripe = makeStripe();
      const activeSub = { id: 'sub_abc', status: 'active', items: { data: [] } };
      stripe.subscriptions.list.mockResolvedValue({ data: [activeSub] });
      stripe.subscriptions.update.mockResolvedValue({
        ...activeSub,
        cancel_at_period_end: true,
      });
      (svc as any).stripe = stripe;

      const result = await svc.cancelSubscription(tenant) as any;
      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_abc', {
        cancel_at_period_end: true,
      });
      expect(result.cancel_at_period_end).toBe(true);
    });
  });

  // ── listInvoices ───────────────────────────────────────────────────────────
  describe('listInvoices', () => {
    it('returns empty array when no customer', async () => {
      const fromFn = jest.fn(() => makeChain({ stripe_customer_id: null }));
      const { svc } = makeService({ fromFn });
      expect(await svc.listInvoices(tenant)).toEqual([]);
    });
  });

  // ── handleWebhook — webhook secret non configuré ───────────────────────────
  describe('handleWebhook secret missing', () => {
    it('throws ServiceUnavailableException', async () => {
      const { svc } = makeService({ webhookSecret: 'replace_me' });
      await expect(
        svc.handleWebhook(Buffer.from('body'), 'sig'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ── handleWebhook — signature invalide ────────────────────────────────────
  describe('handleWebhook invalid signature', () => {
    it('throws BadRequestException on invalid signature', async () => {
      const { svc } = makeService();
      const stripe = makeStripe();
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found');
      });
      (svc as any).stripe = stripe;
      await expect(
        svc.handleWebhook(Buffer.from('body'), 'bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── handleWebhook — idempotence ────────────────────────────────────────────
  describe('handleWebhook idempotence', () => {
    it('ignores duplicate events (UNIQUE violation code 23505)', async () => {
      const dupError = { code: '23505', message: 'duplicate key' };
      const fromFn = jest.fn(() => makeChain(null, dupError));
      const { svc } = makeService({ fromFn });

      const stripe = makeStripe();
      const fakeEvent = {
        id: 'evt_dup',
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_001' } },
      };
      stripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
      (svc as any).stripe = stripe;

      // Must resolve without throwing
      await expect(
        svc.handleWebhook(Buffer.from('body'), 'sig'),
      ).resolves.toBeUndefined();
    });

    it('processes new event and marks it processed', async () => {
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      const fromFn = jest
        .fn()
        .mockReturnValueOnce(makeChain(null, null))           // insert OK
        .mockReturnValue({ update: jest.fn().mockReturnValue({ eq: updateEq }) });

      const { svc } = makeService({ fromFn });
      const stripe = makeStripe();
      const fakeEvent = {
        id: 'evt_new',
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_002' } },
      };
      stripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
      (svc as any).stripe = stripe;

      await svc.handleWebhook(Buffer.from('body'), 'sig');
      expect(updateEq).toHaveBeenCalled();
    });
  });
});
