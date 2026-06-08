/**
 * Tests unitaires — PayEngineService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PayEngineService } from './pay-engine.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult = { data: null as unknown, error: null as unknown },
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
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb({ data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };
const TENANT_ID = 'tenant-0001';

describe('PayEngineService', () => {
  let service: PayEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<PayEngineService>(PayEngineService);
  });

  it('1. getProviders → DB vide → retourne liste par défaut', async () => {
    // Le thenable doit résoudre avec data: null pour que `data ?? [defaults]` retourne les défauts
    // On passe listResult explicitement à null pour éviter que le thenable retourne []
    const chain = buildChain({ data: null, error: null });
    // Surcharge: le then résout avec data: null
    chain.then = jest
      .fn()
      .mockImplementation((res: any) =>
        Promise.resolve(res({ data: null, error: null })),
      );
    mockSupabase.client.from.mockReturnValueOnce(chain);
    const result = await service.getProviders(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('2. enableProvider → retourne provider + enabled', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    const result = await service.enableProvider(TENANT_ID, 'cinetpay', true);
    expect(result).toMatchObject({ provider: 'cinetpay', enabled: true });
  });

  it('3. createCinetPayPayment → clé absente → status disabled', async () => {
    mockConfig.get.mockReturnValue(undefined);
    const result = await service.createCinetPayPayment(
      TENANT_ID,
      5000,
      'XOF',
      'txn-001',
    );
    expect(result).toMatchObject({ status: 'disabled' });
  });

  it('4. createCinetPayPayment → clé replace_me → status disabled', async () => {
    mockConfig.get.mockReturnValue('replace_me');
    const module = await Test.createTestingModule({
      providers: [
        PayEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    const svc = module.get<PayEngineService>(PayEngineService);
    const result = await svc.createCinetPayPayment(
      TENANT_ID,
      5000,
      'XOF',
      'txn-002',
    );
    expect(result).toMatchObject({ status: 'disabled' });
  });

  it('5. getTransactions → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.getTransactions(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});
