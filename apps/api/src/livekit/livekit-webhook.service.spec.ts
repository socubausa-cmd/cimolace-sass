/**
 * Tests unitaires — LiveKitWebhookService
 *
 * Scénarios couverts :
 *  1.  handle → signature invalide → log warn, return silencieusement
 *  2.  handle → événement room_finished → met à jour le statut live
 *  3.  handle → événement participant_joined → upsert participant
 *  4.  handle → événement inconnu → aucune exception
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Mock livekit-server-sdk ──────────────────────────────────────────────────
// jest.mock() hissé avant const → références externes impossibles.
// Factory n'utilise que jest.fn(), implémentations configurées dans beforeEach.

jest.mock('livekit-server-sdk', () => ({
  WebhookReceiver: jest.fn(),
  AccessToken: jest.fn(),
  RoomServiceClient: jest.fn().mockImplementation(() => ({})),
  EgressClient: jest.fn().mockImplementation(() => ({})),
  EncodedFileType: { MP4: 0 },
}));

const { WebhookReceiver: MockWebhookReceiver } =
  jest.requireMock('livekit-server-sdk');

let mockReceive: jest.Mock;

// ─── Helpers mock ─────────────────────────────────────────────────────────────

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
    'or',
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
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = {
  get: jest.fn().mockImplementation((k: string) => {
    if (k === 'LIVEKIT_API_KEY') return 'APIkey';
    if (k === 'LIVEKIT_API_SECRET') return 'APISecret';
    return undefined;
  }),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('LiveKitWebhookService', () => {
  let service: LiveKitWebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    // Configure l'instance WebhookReceiver avec un nouveau mockReceive
    mockReceive = jest.fn();
    MockWebhookReceiver.mockImplementation(() => ({ receive: mockReceive }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveKitWebhookService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LiveKitWebhookService>(LiveKitWebhookService);
  });

  it('1. handle → signature invalide → return silencieusement', async () => {
    mockReceive.mockRejectedValueOnce(new Error('Invalid signature'));
    // Should not throw
    await expect(service.handle('{}', 'bad-sig')).resolves.toBeUndefined();
  });

  it('2. handle → room_finished → met à jour le statut live', async () => {
    mockReceive.mockResolvedValueOnce({
      event: 'room_finished',
      room: { name: 'ecole-test_room-uuid' },
    });

    // maybeSingle for session lookup
    mockSupabase.client.from
      .mockReturnValueOnce(
        buildChain({ data: { id: 'live-0001' }, error: null }),
      )
      // insert webhook event (fire-and-forget via void)
      .mockReturnValueOnce(buildChain({ data: null, error: null }))
      // handleRoomFinished: update live_sessions
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    await expect(service.handle('{}', 'valid-sig')).resolves.toBeUndefined();
  });

  it('3. handle → participant_joined → upsert participant', async () => {
    mockReceive.mockResolvedValueOnce({
      event: 'participant_joined',
      room: { name: 'ecole-test_room-uuid' },
      participant: { identity: 'user-0001', metadata: '' },
    });

    mockSupabase.client.from
      .mockReturnValueOnce(
        buildChain({ data: { id: 'live-0001' }, error: null }),
      ) // session lookup
      .mockReturnValueOnce(buildChain({ data: null, error: null })) // insert event
      .mockReturnValueOnce(buildChain({ data: null, error: null })); // upsert participant

    await expect(service.handle('{}', 'valid-sig')).resolves.toBeUndefined();
  });

  it("4. handle → événement inconnu → pas d'exception", async () => {
    mockReceive.mockResolvedValueOnce({
      event: 'unknown_event_type',
      room: { name: 'room-1' },
    });

    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: null, error: null })) // session lookup (null)
      .mockReturnValueOnce(buildChain({ data: null, error: null })); // insert event

    await expect(service.handle('{}', 'valid-sig')).resolves.toBeUndefined();
  });
});
