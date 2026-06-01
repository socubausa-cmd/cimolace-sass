/**
 * Tests unitaires — MarketingAdvancedService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MarketingAdvancedService } from './marketing-advanced.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult: { data?: unknown; count?: number; error?: unknown } = {
    data: null,
    count: 0,
    error: null,
  },
) {
  const chain: Record<string, jest.Mock> = {};
  [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'limit',
    'order',
  ].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(
      cb({
        data: Array.isArray(singleResult.data) ? singleResult.data : [],
        count: singleResult.count ?? 0,
        error: null,
      }),
    ),
  );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';
const FAKE_FUNNEL = { id: 'funnel-001', name: 'Funnel test', status: 'draft' };
const FAKE_CAMPAIGN = {
  id: 'camp-001',
  name: 'Campagne test',
  status: 'draft',
};

describe('MarketingAdvancedService', () => {
  let service: MarketingAdvancedService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingAdvancedService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<MarketingAdvancedService>(MarketingAdvancedService);
  });

  it('1. listFunnels → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_FUNNEL], error: null }),
    );
    const result = await service.listFunnels(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('2. createFunnel → retourne funnel', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_FUNNEL, error: null }),
    );
    const result = await service.createFunnel(TENANT_ID, 'Funnel test', []);
    expect(result).toMatchObject({ id: 'funnel-001' });
  });

  it('3. listCampaigns → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_CAMPAIGN], error: null }),
    );
    const result = await service.listCampaigns(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('4. createCampaign → retourne campagne', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_CAMPAIGN, error: null }),
    );
    const result = await service.createCampaign(TENANT_ID, {
      name: 'Campagne test',
      type: 'email',
      channel: 'resend',
      content: 'Contenu',
    });
    expect(result).toMatchObject({ id: 'camp-001' });
  });

  it('5. startCampaign → retourne campagne active', async () => {
    const active = { ...FAKE_CAMPAIGN, status: 'running' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: active, error: null }),
    );
    const result = await service.startCampaign(TENANT_ID, 'camp-001');
    expect(result).toMatchObject({ status: 'running' });
  });

  it('6. listAutomations → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listAutomations(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('7. getAnalytics → retourne compteurs', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: [], count: 5 })) // campaigns
      .mockReturnValueOnce(buildChain({ data: [], count: 120 })) // leads
      .mockReturnValueOnce(buildChain({ data: [], count: 3 })); // promos

    const result = await service.getAnalytics(TENANT_ID);
    expect(result).toMatchObject({
      totalCampaigns: 5,
      totalLeads: 120,
      totalPromos: 3,
    });
  });
});
