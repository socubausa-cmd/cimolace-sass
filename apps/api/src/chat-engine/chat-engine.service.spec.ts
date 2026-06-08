/**
 * Tests unitaires — ChatEngineService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ChatEngineService } from './chat-engine.service';
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

const TENANT_ID = 'tenant-0001';
const USER_ID = 'user-0001';
const mockSupabase = {
  client: {
    from: jest.fn(),
    channel: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
  },
};

describe('ChatEngineService', () => {
  let service: ChatEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<ChatEngineService>(ChatEngineService);
  });

  it('1. createRoom → retourne room', async () => {
    const fakeRoom = { id: 'room-001', name: 'Général', type: 'group' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeRoom, error: null }),
    );
    const result = await service.createRoom(TENANT_ID, 'Général');
    expect(result).toMatchObject({ id: 'room-001' });
  });

  it('2. listRooms → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listRooms(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('3. sendMessage → retourne message', async () => {
    const fakeMsg = { id: 'msg-001', content: 'Hello', room_id: 'room-001' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeMsg, error: null }),
    );
    const result = await service.sendMessage(
      TENANT_ID,
      'room-001',
      USER_ID,
      'Hello',
    );
    expect(result).toMatchObject({ id: 'msg-001' });
  });

  it('4. getMessages → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.getMessages(TENANT_ID, 'room-001');
    expect(Array.isArray(result)).toBe(true);
  });

  it('5. subscribeToRoom → retourne objet channel', async () => {
    const result = await service.subscribeToRoom(TENANT_ID, 'room-001');
    expect(result).toHaveProperty('channel');
    expect(result).toHaveProperty('status', 'subscribed');
  });

  it('6. getOnlineUsers → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.getOnlineUsers(TENANT_ID, 'room-001');
    expect(Array.isArray(result)).toBe(true);
  });
});
