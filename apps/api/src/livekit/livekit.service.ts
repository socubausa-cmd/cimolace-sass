import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const key = config.get<string>('LIVEKIT_API_KEY') ?? '';
    const secret = config.get<string>('LIVEKIT_API_SECRET') ?? '';
    this.configured = Boolean(
      key && key !== 'replace_me' && secret && secret !== 'replace_me',
    );
    if (!this.configured) {
      this.logger.warn(
        'LIVEKIT_API_KEY / LIVEKIT_API_SECRET non configurés — tokens LiveKit désactivés',
      );
    }
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

  private assertConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Service LiveKit non configuré (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)',
      );
    }
  }
}
