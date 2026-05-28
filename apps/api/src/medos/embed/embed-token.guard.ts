import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import { EmbedJwtPayload, EmbedScope } from './embed.types';

type EmbedRequest = Request & {
  tenant?: TenantContext;
  user?: { id: string };
  embedScope?: EmbedScope[];
  authViaEmbed?: boolean;
};

export const EMBED_SCOPE_KEY = 'medos:embed-scope';

/**
 * Décorateur compagnon pour restreindre une route à un scope embed.
 * Sans ce décorateur, le guard valide le JWT mais ne vérifie pas le scope.
 *
 * @example
 * ```ts
 * @Get('me/notes')
 * @UseGuards(EmbedTokenGuard)
 * @RequireEmbedScope('med:notes:read')
 * listMyNotes() { ... }
 * ```
 */
import { SetMetadata } from '@nestjs/common';
export const RequireEmbedScope = (scope: EmbedScope) =>
  SetMetadata(EMBED_SCOPE_KEY, scope);

/**
 * Guard pour les requêtes du widget MEDOS embarqué.
 *
 * Décode le JWT embed-token, peuple `req.tenant` à partir du `tenant_id`
 * du payload, vérifie le scope si présent. Court-circuite l'auth Supabase
 * (le widget n'a pas de session utilisateur classique).
 */
@Injectable()
export class EmbedTokenGuard implements CanActivate {
  private readonly logger = new Logger(EmbedTokenGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<EmbedRequest>();
    const auth = req.headers['authorization'];

    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Embed token requis');
    }

    const token = auth.slice(7).trim();

    const secret = this.config.get<string>('MEDOS_EMBED_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException(
        'Service embed indisponible (config manquante)',
      );
    }

    let payload: EmbedJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<EmbedJwtPayload>(token, { secret });
    } catch (err: any) {
      this.logger.debug(`embed-token decode failed: ${err?.message}`);
      throw new UnauthorizedException('Embed token invalide ou expiré');
    }

    if (payload.iss !== 'cimolace-medos-embed') {
      throw new UnauthorizedException('Embed token issuer invalide');
    }

    // Vérifier scope si la route le demande
    const requiredScope = this.reflector.getAllAndOverride<
      EmbedScope | undefined
    >(EMBED_SCOPE_KEY, [ctx.getHandler(), ctx.getClass()]);

    if (requiredScope && !payload.scope.includes(requiredScope)) {
      throw new ForbiddenException(
        `Scope manquant : ${requiredScope} (mode ${payload.mode})`,
      );
    }

    // Résoudre tenant
    const { data: tenant, error } = await (this.supabase.client as any)
      .from('tenants')
      .select('*')
      .eq('id', payload.tenant_id)
      .single();

    if (error || !tenant) {
      throw new UnauthorizedException('Tenant lié au token introuvable');
    }

    // Rôle synthétique : pour les modes patient-*, on agit comme un 'patient'
    const role = payload.mode.includes('patient') ? 'patient' : 'patient';
    req.tenant = { ...(tenant as any), userRole: role };
    req.user = payload.sub ? { id: payload.sub } : { id: 'embed-anonymous' };
    req.embedScope = payload.scope;
    req.authViaEmbed = true;

    return true;
  }
}
