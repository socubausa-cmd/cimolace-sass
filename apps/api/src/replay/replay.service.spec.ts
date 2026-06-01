/**
 * Tests unitaires — ReplayService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ReplayService } from './replay.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult = { data: null as unknown, error: null as unknown },
) {
  const chain: Record<string, jest.Mock> = {};
  [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'limit',
    'order',
    'filter',
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
const FAKE_REC = {
  id: 'rec-001',
  status: 'completed',
  output_url: 'https://cdn.example.com/rec.mp4',
};

describe('ReplayService', () => {
  let service: ReplayService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<ReplayService>(ReplayService);
  });

  it('1. listRecordings → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_REC], error: null }),
    );
    const result = await service.listRecordings(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('2. getRecording → trouvé → retourne enregistrement', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_REC, error: null }),
    );
    const result = await service.getRecording(TENANT_ID, 'rec-001');
    expect(result).toMatchObject({ id: 'rec-001' });
  });

  it('3. getRecording → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getRecording(TENANT_ID, 'rec-xxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. generatePlaybackUrl → clé Cloudflare absente → retourne type direct', async () => {
    mockConfig.get.mockReturnValue(undefined);
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_REC, error: null }),
    );
    const result = await service.generatePlaybackUrl(TENANT_ID, 'rec-001');
    expect(result).toMatchObject({ type: 'direct', url: FAKE_REC.output_url });
  });

  it('5. generatePlaybackUrl → clé Cloudflare configurée → retourne type cloudflare_stream', async () => {
    mockConfig.get.mockReturnValue('cf-account-123');
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_REC, error: null }),
    );
    const result = await service.generatePlaybackUrl(TENANT_ID, 'rec-001');
    expect(result).toMatchObject({ type: 'cloudflare_stream' });
  });

  it('6. listReplays → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listReplays(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});
