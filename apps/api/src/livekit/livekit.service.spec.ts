/**
 * Tests unitaires — LiveKitService
 *
 * Scénarios couverts :
 *  1.  configured = false quand clés absentes
 *  2.  configured = true quand toutes les clés présentes
 *  3.  generateParticipantToken → non configuré → ServiceUnavailableException
 *  4.  generateHostToken → non configuré → ServiceUnavailableException
 *  5.  ensureRoom → non configuré → ServiceUnavailableException
 *  6.  startRecording → non configuré → ServiceUnavailableException
 *  7.  generateParticipantToken → configuré → retourne JWT string
 *  8.  generateHostToken → configuré → retourne JWT string
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { LiveKitService } from './livekit.service';

// ─── Mock livekit-server-sdk ──────────────────────────────────────────────────
// jest.mock() est hissé (hoisted) avant toute déclaration const/let.
// Les implémentations sont définies à l'intérieur de la factory pour éviter
// les erreurs "Cannot access before initialization".

jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn(),
  RoomServiceClient: jest.fn(),
  EgressClient: jest.fn(),
  EncodedFileType: { MP4: 0 },
}));

// Accès aux constructeurs mockés après le hissage
const {
  AccessToken: MockAccessToken,
  RoomServiceClient: MockRoomServiceClient,
  EgressClient: MockEgressClient,
} = jest.requireMock('livekit-server-sdk');

// Handles sur les méthodes d'instance, initialisés dans beforeEach
let mockToJwt: jest.Mock;
let mockAddGrant: jest.Mock;

// ─── Helper ───────────────────────────────────────────────────────────────────

const mockConfig = { get: jest.fn() };

const buildService = async (url: string, key: string, secret: string) => {
  mockConfig.get.mockImplementation((k: string) => {
    if (k === 'LIVEKIT_URL') return url;
    if (k === 'LIVEKIT_API_KEY') return key;
    if (k === 'LIVEKIT_API_SECRET') return secret;
    return undefined;
  });
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LiveKitService,
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
  return module.get<LiveKitService>(LiveKitService);
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('LiveKitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reconfigure les implémentations d'instance à chaque test
    mockToJwt = jest.fn().mockResolvedValue('lk_jwt_token_test');
    mockAddGrant = jest.fn();
    MockAccessToken.mockImplementation(() => ({
      addGrant: mockAddGrant,
      toJwt: mockToJwt,
    }));
    MockRoomServiceClient.mockImplementation(() => ({
      createRoom: jest.fn().mockResolvedValue({}),
      listRooms: jest.fn().mockResolvedValue([]),
    }));
    MockEgressClient.mockImplementation(() => ({
      startRoomCompositeEgress: jest
        .fn()
        .mockResolvedValue({ egressId: 'egress-001' }),
      stopEgress: jest.fn().mockResolvedValue({}),
    }));
  });

  it('1. configured = false quand clés absentes', async () => {
    const svc = await buildService('', '', '');
    // accessing private via any is intentional in tests
    expect((svc as any).configured).toBe(false);
  });

  it('2. configured = false quand clés = replace_me', async () => {
    const svc = await buildService(
      'wss://test.livekit.cloud',
      'replace_me',
      'replace_me',
    );
    expect((svc as any).configured).toBe(false);
  });

  it('3. configured = true quand toutes les clés sont présentes', async () => {
    const svc = await buildService(
      'wss://test.livekit.cloud',
      'APIkey123',
      'APISecret456',
    );
    expect((svc as any).configured).toBe(true);
  });

  it('4. generateParticipantToken → non configuré → ServiceUnavailableException', async () => {
    const svc = await buildService('', '', '');
    await expect(
      svc.generateParticipantToken('room-1', 'user-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('5. generateHostToken → non configuré → ServiceUnavailableException', async () => {
    const svc = await buildService('', '', '');
    await expect(svc.generateHostToken('room-1', 'user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('6. ensureRoom → non configuré → ServiceUnavailableException', async () => {
    const svc = await buildService('', '', '');
    await expect(svc.ensureRoom('room-1', 'live-1', 'user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('7. startRecording → non configuré → ServiceUnavailableException', async () => {
    const svc = await buildService('', '', '');
    await expect(
      svc.startRecording('room-1', 'live-session-001', 'tenant-test'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('8. generateParticipantToken → configuré → retourne JWT string', async () => {
    const svc = await buildService(
      'wss://test.livekit.cloud',
      'APIkey',
      'APISecret',
    );
    const token = await svc.generateParticipantToken(
      'room-1',
      'user-1',
      'Alice',
    );
    expect(typeof token).toBe('string');
    expect(mockAddGrant).toHaveBeenCalledWith(
      expect.objectContaining({ roomJoin: true, canPublish: false }),
    );
  });

  it('9. generateHostToken → configuré → retourne JWT string avec publish=true', async () => {
    const svc = await buildService(
      'wss://test.livekit.cloud',
      'APIkey',
      'APISecret',
    );
    await svc.generateHostToken('room-1', 'user-host', 'Prof');
    expect(mockAddGrant).toHaveBeenCalledWith(
      expect.objectContaining({ canPublish: true }),
    );
  });
});
