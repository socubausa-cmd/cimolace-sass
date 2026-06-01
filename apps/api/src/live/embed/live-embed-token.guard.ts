import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { LiveEmbedTokenPayload } from './live-embed.types';

type EmbedRequest = Request & {
  embedPayload?: LiveEmbedTokenPayload;
};

/**
 * Guard pour les routes d'embed LIRI Live.
 * Vérifie le JWT signé avec LIRI_EMBED_JWT_SECRET émis par LiveEmbedService.
 * Peuple req.embedPayload avec le payload décodé.
 */
@Injectable()
export class LiveEmbedTokenGuard implements CanActivate {
  private readonly logger = new Logger(LiveEmbedTokenGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<EmbedRequest>();
    const auth = req.headers['authorization'];

    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Embed token requis (Authorization: Bearer <embed_token>)',
      );
    }

    const token = auth.slice(7).trim();

    const secret = this.config.get<string>('LIRI_EMBED_JWT_SECRET');
    if (!secret || secret === 'replace_me') {
      throw new UnauthorizedException(
        'Service embed indisponible (LIRI_EMBED_JWT_SECRET non configuré)',
      );
    }

    let payload: LiveEmbedTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<LiveEmbedTokenPayload>(token, {
        secret,
      });
    } catch (err: any) {
      this.logger.debug(`embed-token verification failed: ${err?.message}`);
      throw new UnauthorizedException('Embed token invalide ou expiré');
    }

    if (payload.iss !== 'cimolace-liri-embed') {
      throw new UnauthorizedException('Embed token issuer invalide');
    }

    req.embedPayload = payload;
    return true;
  }
}
