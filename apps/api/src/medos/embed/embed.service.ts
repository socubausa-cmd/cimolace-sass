import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  EMBED_SCOPES_BY_MODE,
  EmbedJwtPayload,
  EmbedMode,
  isValidEmbedMode,
} from './embed.types';

@Injectable()
export class EmbedService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Émet un JWT court-vivant pour le widget MEDOS embarqué dans un site externe.
   *
   * Flux :
   *   1. Le widget JS sur zahirwellness.com lit `data-tenant="zahirwellness"`
   *   2. Il appelle POST /v1/medos/embed/token avec son Origin
   *   3. Cimolace vérifie que cet Origin est whitelisté pour ce tenant
   *      via `tenant_domains.usage='embed_origin'`
   *   4. Cimolace signe un JWT court (15 min) avec scope = celui du mode demandé
   *   5. Le widget utilise ce JWT pour appeler /v1/medos/*
   *
   * Pas de clé secrète côté navigateur — l'origine HTTP est le facteur de confiance.
   * La validation Origin est faite côté serveur (impossible à spoofer depuis un
   * navigateur grâce au CORS preflight, à condition que le navigateur respecte CORS).
   */
  async issueEmbedToken(input: {
    tenantSlug: string;
    mode: string;
    origin: string | undefined;
    requestedPatientUserId?: string | null;
  }): Promise<{
    token: string;
    expires_in: number;
    api_base: string;
    mode: EmbedMode;
    scope: string[];
  }> {
    const { tenantSlug, mode, origin, requestedPatientUserId } = input;

    if (!isValidEmbedMode(mode)) {
      throw new BadRequestException(`Mode d'embed invalide : ${mode}`);
    }
    if (!origin) {
      throw new ForbiddenException(
        'Header Origin manquant — embed-token refusé',
      );
    }

    const normalizedOrigin = origin.toLowerCase();
    const originHost = this.extractHost(normalizedOrigin);

    // 1. Résoudre le tenant
    const { data: tenant, error: tErr } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, slug, status')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (tErr || !tenant) {
      throw new NotFoundException(`Tenant "${tenantSlug}" introuvable`);
    }
    if ((tenant as any).status !== 'active') {
      throw new ForbiddenException('Tenant inactif');
    }

    // 2. Vérifier que l'Origin est whitelisté pour ce tenant
    const { data: domains, error: dErr } = await (this.supabase.client as any)
      .from('tenant_domains')
      .select('domain, usage, status')
      .eq('tenant_id', (tenant as any).id)
      .eq('usage', 'embed_origin')
      .eq('status', 'active');

    if (dErr) {
      throw new InternalServerErrorException(
        `Lookup tenant_domains failed: ${dErr.message}`,
      );
    }

    const allowedDomains = ((domains ?? []) as Array<{ domain: string }>).map(
      (d) => d.domain.toLowerCase(),
    );

    if (!allowedDomains.includes(originHost)) {
      throw new ForbiddenException(
        `Origin "${origin}" non autorisé pour ce tenant`,
      );
    }

    // 3. Construire le payload
    const scope = EMBED_SCOPES_BY_MODE[mode as EmbedMode];

    const payload: EmbedJwtPayload = {
      tenant_id: (tenant as any).id,
      mode: mode as EmbedMode,
      scope,
      origin: normalizedOrigin,
      iss: 'cimolace-medos-embed',
      ...(requestedPatientUserId ? { sub: requestedPatientUserId } : {}),
    };

    const secret = this.config.get<string>('MEDOS_EMBED_JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'MEDOS_EMBED_JWT_SECRET non configuré',
      );
    }

    const expiresInSec = 60 * 15; // 15 min
    const token = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresInSec,
    });

    const apiBase =
      this.config.get<string>('MEDOS_API_BASE') ?? 'https://api.cimolace.com';

    return {
      token,
      expires_in: expiresInSec,
      api_base: apiBase,
      mode: mode as EmbedMode,
      scope,
    };
  }

  private extractHost(origin: string): string {
    try {
      const u = new URL(origin);
      return u.host;
    } catch {
      return origin;
    }
  }
}
