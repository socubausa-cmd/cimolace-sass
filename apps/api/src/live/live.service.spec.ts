/**
 * Tests unitaires — LiveService
 *
 * Scénarios couverts :
 *  1.  create → owner → crée live + room LiveKit
 *  2.  create → student → ForbiddenException
 *  3.  findAll → retourne tableau
 *  4.  findOne → trouvé → retourne live
 *  5.  findOne → introuvable → NotFoundException
 *  6.  getJoinToken → live cancelled → ForbiddenException
 *  7.  sendChatMessage → insère message
 *  8.  askQuestion → crée question
 *  9.  answerQuestion → répond → retourne question mise à jour
 * 10.  getParticipants → retourne tableau
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LiveService } from './live.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LiveKitService } from '../livekit/livekit.service';

function buildChain(
  singleResult: { data: unknown; error: unknown } = { data: null, error: null },
  listResult?: { data: unknown[]; error: unknown },
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
    'in',
    'limit',
    'order',
    'range',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb(listResult ?? { data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const mockLiveKit = {
  ensureRoom: jest.fn().mockResolvedValue(undefined),
  createToken: jest.fn().mockResolvedValue('lk_token_test'),
  getRoomParticipants: jest.fn().mockResolvedValue([]),
};

const TENANT_OWNER = {
  id: 'tenant-0001',
  slug: 'ecole-test',
  name: 'École Test',
  plan: 'school' as const,
  status: 'active' as const,
  userRole: 'owner' as const,
};

const TENANT_STUDENT = { ...TENANT_OWNER, userRole: 'member' as const };

const USER_ID = 'user-host-001';

const FAKE_LIVE = {
  id: 'live-0001',
  tenant_id: TENANT_OWNER.id,
  host_user_id: USER_ID,
  title: 'Cours en direct',
  status: 'scheduled',
  livekit_room_name: 'ecole-test_room-uuid',
  price_cents: 0,
  currency: 'EUR',
  scheduled_at: new Date(Date.now() + 86400000).toISOString(),
};

describe('LiveService', () => {
  let service: LiveService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockLiveKit.ensureRoom.mockResolvedValue(undefined);
    mockLiveKit.createToken.mockResolvedValue('lk_token_test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: LiveKitService, useValue: mockLiveKit },
      ],
    }).compile();

    service = module.get<LiveService>(LiveService);
  });

  it('1. create → owner → crée live + appelle ensureRoom', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_LIVE, error: null }),
    );

    const result = await service.create(
      {
        title: 'Cours en direct',
        scheduledAt: FAKE_LIVE.scheduled_at,
        priceCents: 0,
      },
      USER_ID,
      TENANT_OWNER as any,
    );

    expect(result).toMatchObject({ id: 'live-0001', status: 'scheduled' });
    expect(mockLiveKit.ensureRoom).toHaveBeenCalledTimes(1);
  });

  it('2. create → student → ForbiddenException', async () => {
    await expect(
      service.create(
        {
          title: 'X',
          scheduledAt: FAKE_LIVE.scheduled_at,
          priceCents: 0,
        } as any,
        USER_ID,
        TENANT_STUDENT as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('3. findAll → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_LIVE], error: null }),
    );
    const result = await service.findAll(TENANT_OWNER.id);
    expect(Array.isArray(result)).toBe(true);
  });

  it('4. findOne → trouvé → retourne live', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_LIVE, error: null }),
    );
    const result = await service.findOne('live-0001', TENANT_OWNER.id);
    expect(result).toMatchObject({ id: 'live-0001', title: 'Cours en direct' });
  });

  it('5. findOne → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.findOne('live-xxxx', TENANT_OWNER.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('6. getJoinToken → live cancelled → ForbiddenException', async () => {
    const cancelledLive = { ...FAKE_LIVE, status: 'cancelled' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: cancelledLive, error: null }),
    );

    await expect(
      service.getJoinToken(
        'live-0001',
        { id: USER_ID, email: 'test@example.com' } as any,
        TENANT_OWNER as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('7. sendChatMessage → insère message', async () => {
    // findOne
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_LIVE, error: null }))
      // insert message
      .mockReturnValueOnce(
        buildChain({ data: { id: 'msg-001' }, error: null }),
      );

    const result = await service.sendChatMessage(
      'live-0001',
      TENANT_OWNER as any,
      USER_ID,
      { content: 'Bonjour' },
    );
    expect(result).toBeDefined();
  });

  it('8. askQuestion → crée question', async () => {
    // findOne
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_LIVE, error: null }))
      // insert question
      .mockReturnValueOnce(
        buildChain({
          data: { id: 'q-001', content: 'Question ?', status: 'open' },
          error: null,
        }),
      );

    const result = await service.askQuestion(
      'live-0001',
      TENANT_OWNER as any,
      USER_ID,
      { content: 'Question ?' },
    );
    expect(result).toMatchObject({ id: 'q-001' });
  });

  it('9. answerQuestion → répond → retourne question mise à jour', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({
        data: { id: 'q-001', status: 'answered', answer: 'Réponse.' },
        error: null,
      }),
    );

    const result = await service.answerQuestion(
      'live-0001',
      'q-001',
      TENANT_OWNER.id,
      USER_ID,
      { content: 'Réponse.' },
    );
    expect(result).toMatchObject({ status: 'answered' });
  });

  it('10. getParticipants → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [], error: null }),
    );
    const result = await service.getParticipants('live-0001', TENANT_OWNER.id);
    expect(Array.isArray(result)).toBe(true);
  });
});
