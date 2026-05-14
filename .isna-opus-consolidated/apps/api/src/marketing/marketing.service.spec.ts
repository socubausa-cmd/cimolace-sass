import { ConflictException, NotImplementedException } from '@nestjs/common';
import { MarketingService } from './marketing.service';

type QueryResult = {
  data?: unknown;
  error?: { code?: string; message: string } | null;
};

function chain(result: QueryResult) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };
  return query;
}

function makeService(from: jest.Mock, enabled = true) {
  const config = {
    get: jest.fn((key: string) =>
      key === 'USE_API_V2_MARKETING' && enabled ? '1' : undefined,
    ),
  };

  return new MarketingService(config as never, { client: { from } } as never);
}

describe('MarketingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests when the marketing flag is disabled', async () => {
    await expect(
      makeService(jest.fn(), false).findAllPromoCodes('tenant-1'),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('lists promo codes scoped to the current tenant', async () => {
    const rows = [{ id: 'promo-1', code: 'WELCOME' }];
    const query = chain({ data: rows, error: null });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      makeService(from).findAllPromoCodes('tenant-1'),
    ).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith('promo_codes');
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('creates a normalized promo code', async () => {
    const row = { id: 'promo-1', code: 'WELCOME10' };
    const query = chain({ data: row, error: null });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      makeService(from).createPromoCode(
        {
          code: ' welcome10 ',
          discountType: 'percent',
          discountValue: 10,
        },
        'tenant-1',
      ),
    ).resolves.toEqual(row);

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        code: 'WELCOME10',
        discount_type: 'percent',
        discount_value: 10,
        is_active: true,
      }),
    );
  });

  it('raises a conflict for duplicate promo codes in the same tenant', async () => {
    const query = chain({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      makeService(from).createPromoCode(
        {
          code: 'WELCOME',
          discountType: 'fixed',
          discountValue: 500,
        },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a popup for the current tenant', async () => {
    const row = { id: 'popup-1', title: 'Newsletter' };
    const query = chain({ data: row, error: null });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      makeService(from).createPopup(
        {
          title: 'Newsletter',
          content: 'Inscription',
          triggerType: 'exit_intent',
        },
        'tenant-1',
      ),
    ).resolves.toEqual(row);

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        trigger_type: 'exit_intent',
        is_active: true,
      }),
    );
  });

  it('creates a banner for the current tenant', async () => {
    const row = { id: 'banner-1', text: 'Nouveau live' };
    const query = chain({ data: row, error: null });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      makeService(from).createBanner(
        {
          text: 'Nouveau live',
          ctaUrl: 'https://example.test/live',
          ctaLabel: 'Voir',
        },
        'tenant-1',
      ),
    ).resolves.toEqual(row);

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        cta_url: 'https://example.test/live',
        cta_label: 'Voir',
        is_active: true,
      }),
    );
  });
});
