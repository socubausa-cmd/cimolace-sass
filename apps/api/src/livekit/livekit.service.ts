import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileType,
  EncodedFileOutput,
  S3Upload,
} from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly livekitUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const url = config.get<string>('LIVEKIT_URL') ?? '';
    const key = config.get<string>('LIVEKIT_API_KEY') ?? '';
    const secret = config.get<string>('LIVEKIT_API_SECRET') ?? '';
    this.configured = Boolean(
      url && key && key !== 'replace_me' && secret && secret !== 'replace_me',
    );
    if (!this.configured) {
      this.logger.warn(
        'LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET non configurés — LiveKit désactivé',
      );
    }
    this.livekitUrl = url;
    this.apiKey = key;
    this.apiSecret = secret;
  }

  /** Public LiveKit URL (wss://…) for clients to connect to. */
  getUrl(): string {
    return this.livekitUrl;
  }

  async generateParticipantToken(
    roomName: string,
    userId: string,
    displayName?: string,
  ): Promise<string> {
    this.assertConfigured();
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: false,
      canSubscribe: true,
    });
    return at.toJwt();
  }

  async generateHostToken(
    roomName: string,
    userId: string,
    displayName?: string,
  ): Promise<string> {
    this.assertConfigured();
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      ttl: '4h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: true,
    });
    return at.toJwt();
  }

  /**
   * "Peer" token — a guest who CAN publish (camera + mic) but is NOT a room
   * admin. This is the right profile for a teleconsultation PATIENT: a live
   * two-way call where the patient must show their camera, while the
   * practitioner keeps control of the room (roomAdmin stays host-only).
   *
   * Distinct from generateParticipantToken (subscribe-only, for a class
   * viewer who only watches) — DO NOT change that one: live classes rely on
   * students being publish-disabled by default.
   */
  async generatePeerToken(
    roomName: string,
    userId: string,
    displayName?: string,
  ): Promise<string> {
    this.assertConfigured();
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return at.toJwt();
  }

  /**
   * Raw token with custom identity + metadata — for opaque companion / mobile-
   * camera joins (identity like `companion_<rowId>` / `liri_mobile_<rowId>`) and
   * immersive guests. Publish-enabled (camera) by default, subscribe always on,
   * NOT room admin. Used by ImmersiveLiveService (ports the v1 Netlify lambdas).
   */
  async generateRawToken(opts: {
    roomName: string;
    identity: string;
    name?: string;
    metadata?: Record<string, unknown>;
    ttl?: string;
    canPublish?: boolean;
  }): Promise<string> {
    this.assertConfigured();
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: opts.identity,
      name: opts.name,
      ttl: opts.ttl ?? '30m',
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
    });
    at.addGrant({
      roomJoin: true,
      room: opts.roomName,
      canPublish: opts.canPublish ?? true,
      canSubscribe: true,
      canPublishData: true,
    });
    return at.toJwt();
  }

  async ensureRoom(
    roomName: string,
    liveSessionId: string,
    hostUserId: string,
  ): Promise<void> {
    this.assertConfigured();
    const roomService = new RoomServiceClient(
      this.livekitUrl,
      this.apiKey,
      this.apiSecret,
    );
    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60,
        maxParticipants: 100,
        metadata: JSON.stringify({ liveSessionId, hostUserId }),
      });
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? '');
      if (!msg.includes('already exists')) {
        this.logger.error('ensureRoom failed', msg);
        throw new ServiceUnavailableException(
          'Impossible de créer la room LiveKit',
        );
      }
    }
  }

  static scopedRoomName(tenantSlug: string, sessionId: string): string {
    const t = tenantSlug.replace(/[^a-z0-9_-]/gi, '');
    const s = sessionId.replace(/-/g, '');
    return `${t}_${s}`;
  }

  async startRecording(
    roomName: string,
    liveSessionId: string,
    tenantSlug: string,
  ): Promise<{ egressId: string | null; filepath: string }> {
    this.assertConfigured();
    const egressClient = new EgressClient(
      this.livekitUrl,
      this.apiKey,
      this.apiSecret,
    );
    const filepath = `tenants/${tenantSlug}/recordings/${liveSessionId}/${Date.now()}.mp4`;

    const r2AccountId = process.env.CF_R2_ACCOUNT_ID;
    const r2Key = process.env.CF_R2_ACCESS_KEY_ID;
    const r2Secret = process.env.CF_R2_SECRET_ACCESS_KEY;
    const r2Bucket = process.env.CF_R2_BUCKET;
    const r2Configured = Boolean(r2AccountId && r2Key && r2Secret && r2Bucket);

    // SDK v2 : l'output doit être une instance EncodedFileOutput, avec la
    // destination S3/R2 dans le oneof `output` (case 's3'), et être passée
    // DIRECTEMENT à startRoomCompositeEgress — pas via `{ file: {...} }` (objet
    // simple), que le SDK ne mappe pas → 400 « missing or invalid field: output ».
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: r2Configured
        ? {
            case: 's3',
            value: new S3Upload({
              accessKey: r2Key!,
              secret: r2Secret!,
              region: 'auto',
              bucket: r2Bucket!,
              endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
              forcePathStyle: true,
            }),
          }
        : { case: undefined },
    });

    try {
      const egressInfo = await egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        { layout: 'grid' },
      );
      const egressId =
        (egressInfo as any).egressId ??
        (egressInfo as any).egress_id ??
        null;
      return { egressId: String(egressId ?? ''), filepath };
    } catch (err) {
      this.logger.error('startRecording failed', (err as Error).message);
      return { egressId: null, filepath };
    }
  }

  async stopRecording(egressId: string): Promise<void> {
    this.assertConfigured();
    const egressClient = new EgressClient(
      this.livekitUrl,
      this.apiKey,
      this.apiSecret,
    );
    try {
      await egressClient.stopEgress(egressId);
    } catch (err) {
      this.logger.error('stopRecording failed', (err as Error).message);
    }
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Service LiveKit non configuré (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)',
      );
    }
  }
}
