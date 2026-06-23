/**
 * SocialOAuthService — flux OAuth2 pour connecter les comptes réseaux sociaux
 * (TikTok, Facebook/Instagram via Meta, LinkedIn) et stocker les tokens dans
 * social_tokens. Générique + configuré par plateforme.
 *
 * Identifiants d'app (gestes fondateur) attendus en env :
 *   SOCIAL_TIKTOK_CLIENT_ID / SOCIAL_TIKTOK_CLIENT_SECRET
 *   SOCIAL_FACEBOOK_CLIENT_ID / SOCIAL_FACEBOOK_CLIENT_SECRET
 *   SOCIAL_LINKEDIN_CLIENT_ID / SOCIAL_LINKEDIN_CLIENT_SECRET
 * Redirect URI à enregistrer côté plateforme :
 *   {PUBLIC_API_URL}/social-publisher/oauth/{platform}/callback
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as jwt from 'jsonwebtoken';

export type PlatformKey = 'tiktok' | 'facebook' | 'linkedin';

const PLATFORMS: Record<
  PlatformKey,
  { authUrl: string; tokenUrl: string; scope: string; clientIdParam: string }
> = {
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,video.publish,video.upload',
    clientIdParam: 'client_key', // TikTok nomme le client "client_key"
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope:
      'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish',
    clientIdParam: 'client_id',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'w_member_social',
    clientIdParam: 'client_id',
  },
};

@Injectable()
export class SocialOAuthService {
  private readonly logger = new Logger(SocialOAuthService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  isPlatform(p: string): p is PlatformKey {
    return p === 'tiktok' || p === 'facebook' || p === 'linkedin';
  }

  private creds(platform: PlatformKey) {
    const P = platform.toUpperCase();
    return {
      clientId: this.config.get<string>(`SOCIAL_${P}_CLIENT_ID`),
      clientSecret: this.config.get<string>(`SOCIAL_${P}_CLIENT_SECRET`),
    };
  }

  private redirectUri(platform: PlatformKey) {
    const base =
      this.config.get<string>('PUBLIC_API_URL') || 'https://api.cimolace.space';
    return `${base}/social-publisher/oauth/${platform}/callback`;
  }

  private stateSecret() {
    return this.config.get<string>('SUPABASE_JWT_SECRET') || 'replace_me';
  }

  /** URL vers laquelle envoyer l'utilisateur pour autoriser l'app. */
  getAuthorizeUrl(platform: PlatformKey, tenantId: string, userId: string): string {
    const cfg = PLATFORMS[platform];
    const { clientId } = this.creds(platform);
    if (!clientId) {
      throw new BadRequestException(
        `App ${platform} non configurée (env SOCIAL_${platform.toUpperCase()}_CLIENT_ID manquant)`,
      );
    }
    // state signé = anti-CSRF + porte le tenant/user (le callback est public).
    const state = jwt.sign({ tenantId, userId, platform }, this.stateSecret(), {
      expiresIn: '15m',
    });
    const params = new URLSearchParams({
      [cfg.clientIdParam]: clientId,
      redirect_uri: this.redirectUri(platform),
      scope: cfg.scope,
      response_type: 'code',
      state,
    });
    return `${cfg.authUrl}?${params.toString()}`;
  }

  /** Callback : échange le code contre un token et le stocke dans social_tokens. */
  async handleCallback(
    platform: PlatformKey,
    code: string,
    state: string,
  ): Promise<{ tenantId: string }> {
    if (!code) throw new BadRequestException('code manquant');
    const cfg = PLATFORMS[platform];
    let payload: { tenantId: string; platform: string };
    try {
      payload = jwt.verify(state, this.stateSecret()) as any;
    } catch {
      throw new BadRequestException('state invalide ou expiré');
    }
    if (payload.platform !== platform) {
      throw new BadRequestException('state incohérent');
    }
    const { clientId, clientSecret } = this.creds(platform);
    if (!clientId || !clientSecret) {
      throw new BadRequestException(`App ${platform} non configurée`);
    }

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(platform),
      [cfg.clientIdParam]: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.error(
        `OAuth ${platform} token ${res.status}: ${JSON.stringify(data).slice(0, 200)}`,
      );
      throw new BadRequestException(`échange token ${platform} échoué`);
    }
    // TikTok renvoie parfois les champs sous data.* ; on normalise.
    const accessToken = data.access_token || data.data?.access_token;
    const refreshToken =
      data.refresh_token || data.data?.refresh_token || null;
    const expiresIn = data.expires_in || data.data?.expires_in || null;
    if (!accessToken) throw new BadRequestException(`pas de token ${platform}`);
    const expiresAt = expiresIn
      ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
      : null;

    await (this.supabase.client as any).from('social_tokens').upsert(
      {
        tenant_id: payload.tenantId,
        platform,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: data.token_type || 'bearer',
        expires_at: expiresAt,
        metadata: {
          open_id: data.open_id || data.data?.open_id || null,
          scope: data.scope || cfg.scope,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,platform' },
    );

    this.logger.log(`✅ OAuth ${platform} connecté (tenant ${payload.tenantId})`);
    return { tenantId: payload.tenantId };
  }
}
