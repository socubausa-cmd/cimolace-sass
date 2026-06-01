/**
 * Tests unitaires — MessagingService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
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
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb({ data: [], error: null })),
    );
  chain.rpc = jest
    .fn()
    .mockResolvedValue({ data: { conversation_id: 'conv-001' }, error: null });
  return chain;
}

const mockSupabase = { client: { from: jest.fn(), rpc: jest.fn() } };
const TENANT = {
  id: 'tenant-0001',
  slug: 'ecole',
  name: 'École',
  plan: 'school' as const,
  status: 'active' as const,
  userRole: 'owner' as const,
};
const USER_ID = 'user-0001';
const RECIPIENT_ID = 'user-0002';

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockSupabase.client.rpc = jest.fn().mockResolvedValue({
      data: { conversation_id: 'conv-001' },
      error: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<MessagingService>(MessagingService);
  });

  it('1. sendMessage → retourne message créé', async () => {
    const fakeMsg = { id: 'msg-001', content: 'Bonjour', sender_id: USER_ID };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeMsg, error: null }),
    );

    const result = await service.sendMessage(TENANT as any, USER_ID, {
      recipientId: RECIPIENT_ID,
      content: 'Bonjour',
    });
    expect(result).toMatchObject({ id: 'msg-001' });
  });

  it('2. sendMessage → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'insert failed' } }),
    );
    await expect(
      service.sendMessage(TENANT as any, USER_ID, {
        recipientId: RECIPIENT_ID,
        content: 'Test',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. listConversations → aucune participation → retourne tableau vide', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listConversations(TENANT.id, USER_ID);
    expect(result).toEqual([]);
  });

  it('4. getMessages → participation non trouvée → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(
      service.getMessages(TENANT.id, 'conv-001', USER_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. createGroup → retourne conversation groupe', async () => {
    const fakeConv = { id: 'conv-grp-001', type: 'group', name: 'Groupe test' };
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: fakeConv, error: null })) // insert conversation
      .mockReturnValueOnce(buildChain({ data: null, error: null })); // insert participant

    const result = await service.createGroup(TENANT as any, USER_ID, {
      name: 'Groupe test',
    });
    expect(result).toMatchObject({ type: 'group' });
  });
});
