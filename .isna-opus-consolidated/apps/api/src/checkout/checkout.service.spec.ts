/**
 * CheckoutService unit tests
 *
 * Strategy: avoid jest.mock('stripe') top-level — variables captured in the
 * factory are undefined at hoist time (classic Jest gotcha). Instead we inject
 * a plain mock object directly into the private `stripe` property.
 */

import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

// ── Supabase chain helper ──────────────────────────────────────────────────────
type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result: QueryResult) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    or: jest.fn(() => query),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    upsert: jest.fn(async () => result),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
  };
  return query;
}

// ── Service factory ────────────────────────────────────────────────────────────
function makeService(from: jest.Mock) {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_unit',
        STRIPE_WEBHOOK_SECRET: 'whsec_unit',
        FRONTEND_URL: 'http://localhost:3001',
      };
      return values[key];
    }),
  };

  return new CheckoutService(config as never, { client: { from } } as never, null as never);
}

// ── Stripe mock factory ────────────────────────────────────────────────────────
function makeStripe() {
  return {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('CheckoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a connected checkout session with tenant metadata', async () => {
    const live = {
      id: 'live-1',
      title: 'Live test',
      price_cents: 1900,
      currency: 'EUR',
      tenant_id: 'tenant-1',
      status: 'scheduled',
    };

    const liveQuery = chain({ data: live, error: null });
    const accessQuery = chain({ data: null, error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(liveQuery)
      .mockReturnValueOnce(accessQuery);

    const svc = makeService(from);
    const stripe = makeStripe();
    stripe.checkout.sessions.create.mockResolvedValueOnce({
      url: 'https://checkout.stripe.test/session',
    });
    (svc as any).stripe = stripe;

    const result = await svc.createSession('user-1', 'live-1');

    expect(result).toEqual({
      checkoutUrl: 'https://checkout.stripe.test/session',
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          userId: 'user-1',
          liveSessionId: 'live-1',
          tenantId: 'tenant-1',
        },
        success_url: 'http://localhost:3001/lives/live-1/join?payment=success',
        cancel_url: 'http://localhost:3001/lives/live-1/join?payment=cancelled',
      }),
      { idempotencyKey: 'checkout-user-1-live-1' },
    );
  });

  it('rejects checkout when the user already has an active access pass', async () => {
    const liveQuery = chain({
      data: {
        id: 'live-1',
        title: 'Live test',
        price_cents: 1900,
        currency: 'EUR',
        tenant_id: 'tenant-1',
        status: 'scheduled',
      },
      error: null,
    });
    const accessQuery = chain({ data: { id: 'pass-1' }, error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(liveQuery)
      .mockReturnValueOnce(accessQuery);

    const svc = makeService(from);
    const stripe = makeStripe();
    (svc as any).stripe = stripe;

    await expect(svc.createSession('user-1', 'live-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('activates access and student membership from a paid webhook', async () => {
    const tenantQuery = chain({ data: { id: 'tenant-1' }, error: null });
    const accessPassQuery = chain({ error: null });
    const membershipQuery = chain({ error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(tenantQuery)
      .mockReturnValueOnce(accessPassQuery)
      .mockReturnValueOnce(membershipQuery);

    const svc = makeService(from);
    const stripe = makeStripe();
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          payment_intent: 'pi_123',
          metadata: {
            userId: 'user-1',
            liveSessionId: 'live-1',
            tenantId: 'tenant-1',
          },
        },
      },
    });
    (svc as any).stripe = stripe;

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(accessPassQuery.upsert).toHaveBeenCalledWith(
      {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        resource_type: 'live_session',
        resource_id: 'live-1',
        payment_id: 'pi_123',
        status: 'active',
      },
      {
        onConflict: 'tenant_id,user_id,resource_type,resource_id',
        ignoreDuplicates: true,
      },
    );
    expect(membershipQuery.upsert).toHaveBeenCalledWith(
      {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        role: 'student',
        status: 'active',
      },
      { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
    );
  });
});
