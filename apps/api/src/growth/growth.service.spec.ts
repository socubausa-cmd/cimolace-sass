/**
 * Tests unitaires — GrowthService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GrowthService } from './growth.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  result: { data?: unknown; count?: number; error?: unknown } = {},
) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gte',
    'lte',
    'in',
    'limit',
    'order',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  chain.then = jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(
      cb({
        data: result.data ?? [],
        count: result.count ?? 0,
        error: result.error ?? null,
      }),
    ),
  );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';

describe('GrowthService', () => {
  let service: GrowthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<GrowthService>(GrowthService);
  });

  it('1. getTenantStats → retourne stats agrégées', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ count: 12 })) // members
      .mockReturnValueOnce(buildChain({ count: 5 })) // lives
      .mockReturnValueOnce(buildChain({ count: 3 })) // courses
      .mockReturnValueOnce(
        buildChain({
          data: [{ amount_paid_cents: 4900 }, { amount_paid_cents: 9900 }],
        }),
      ); // revenue

    const result = await service.getTenantStats(TENANT_ID);
    expect(result).toMatchObject({
      totalMembers: 12,
      totalLives: 5,
      totalCourses: 3,
    });
    expect(result.totalRevenueCents).toBe(14800);
  });

  it('2. createLead → retourne lead créé', async () => {
    const fakeLead = {
      id: 'lead-001',
      email: 'test@example.com',
      status: 'new',
    };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeLead }),
    );

    const result = await service.createLead(
      TENANT_ID,
      'test@example.com',
      'website',
    );
    expect(result).toMatchObject({ id: 'lead-001' });
  });

  it('3. listLeads → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(buildChain({ data: [] }));
    const result = await service.listLeads(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('4. scoreLead → retourne leadId + score', async () => {
    mockSupabase.client.from.mockReturnValueOnce(buildChain({ data: null }));
    const result = await service.scoreLead(TENANT_ID, 'lead-001', 85);
    expect(result).toMatchObject({ leadId: 'lead-001', score: 85 });
  });

  it('5. createFunnel → retourne funnel', async () => {
    const fakeFunnel = {
      id: 'funnel-001',
      name: 'Funnel test',
      status: 'draft',
    };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeFunnel }),
    );
    const result = await service.createFunnel(TENANT_ID, 'Funnel test', []);
    expect(result).toMatchObject({ id: 'funnel-001' });
  });

  it('6. startCampaign → retourne status active', async () => {
    mockSupabase.client.from.mockReturnValueOnce(buildChain({ data: null }));
    const result = await service.startCampaign(TENANT_ID, 'campaign-001');
    expect(result).toMatchObject({ status: 'active' });
  });

  it('7. getAnalytics → retourne métriques calculées', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ count: 100 })) // total leads
      .mockReturnValueOnce(buildChain({ count: 20 })) // new leads this month
      .mockReturnValueOnce(buildChain({ count: 10 })); // active subscriptions

    const result = await service.getAnalytics(TENANT_ID);
    expect(result).toHaveProperty('totalLeads', 100);
    expect(result).toHaveProperty('newLeadsThisMonth', 20);
    expect(result).toHaveProperty('activeSubscriptions', 10);
    expect(result).toHaveProperty('conversionRate', 10); // 10/100 = 10%
  });
});
