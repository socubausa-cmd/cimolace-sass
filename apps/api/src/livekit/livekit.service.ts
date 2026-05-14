import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, EgressClient, EncodedFileType } from 'livekit-server-sdk';

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

    const fileOutput = r2Configured
      ? {
          fileType: EncodedFileType.MP4,
          filepath,
          s3: {
            accessKey: r2Key!,
            secret: r2Secret!,
            region: 'auto',
            bucket: r2Bucket!,
            endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
          },
        }
      : { fileType: EncodedFileType.MP4, filepath };

    try {
      const egressInfo = await egressClient.startRoomCompositeEgress(roomName, {
        file: fileOutput as any,
      });
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
