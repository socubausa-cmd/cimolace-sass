/**
 * SocialOAuthService — flux OAuth2 pour connecter les comptes réseaux sociaux
 * (TikTok, Facebook/Instagram via Meta, LinkedIn) et stocker les tokens dans
 * social_tokens. Générique + configuré par plateforme.
 *
 * Identifiants d'app saisis PAR TENANT depuis le back-office (owner/admin),
 * stockés dans tenants.metadata.social_apps[platform].{client_id,client_secret}.
 * Aucune clé en env : chaque école apporte sa propre app (isolation par tenant).
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
    // openid+profile = lire l'URN du membre (auteur) ; w_member_social = publier.
    // Produits LinkedIn requis : « Sign In with LinkedIn using OpenID Connect »
    // + « Share on LinkedIn ».
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'openid profile w_member_social',
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

  // Identifiants d'app STRICTEMENT par tenant : chaque école saisit ses propres
  // clés depuis son back-office (tenants.metadata.social_apps). Pas de repli sur
  // l'env — l'isolation par tenant est le modèle voulu (comme Stripe/PayPal).
  private async creds(platform: PlatformKey, tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();
    const app = (data?.metadata?.social_apps?.[platform] as any) || {};
    return {
      clientId: app.client_id || null,
      clientSecret: app.client_secret || null,
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
  async getAuthorizeUrl(
    platform: PlatformKey,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const cfg = PLATFORMS[platform];
    const { clientId } = await this.creds(platform, tenantId);
    if (!clientId) {
      throw new BadRequestException(
        `App ${platform} non configurée : renseignez le Client ID/Secret dans le back-office de l'école`,
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
    const { clientId, clientSecret } = await this.creds(
      platform,
      payload.tenantId,
    );
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

    // Résout les identifiants exploitables (token de Page Meta + ig_user_id,
    // URN du membre LinkedIn). Sans ça, on ne peut PAS publier.
    const acc = await this.resolveAccount(platform, accessToken);

    await (this.supabase.client as any).from('social_tokens').upsert(
      {
        tenant_id: payload.tenantId,
        platform,
        access_token: acc.accessToken,
        refresh_token: refreshToken,
        token_type: data.token_type || 'bearer',
        expires_at: expiresAt,
        page_id: acc.pageId,
        page_name: acc.pageName,
        metadata: {
          open_id: data.open_id || data.data?.open_id || null,
          scope: data.scope || cfg.scope,
          ...acc.extra,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,platform' },
    );

    this.logger.log(`✅ OAuth ${platform} connecté (tenant ${payload.tenantId})`);
    return { tenantId: payload.tenantId };
  }

  /**
   * Après l'échange OAuth, résout les identifiants nécessaires à la publication :
   * - Facebook/Meta : 1re Page + son access_token (publier exige un token de
   *   PAGE, pas le token user) + compte Instagram Business lié (ig_user_id).
   * - LinkedIn : URN du membre (auteur des posts) via /userinfo (OpenID).
   * Tolérant : en cas d'échec on garde le token brut (la connexion réussit, la
   * résolution pourra être refaite plus tard).
   */
  private async resolveAccount(
    platform: PlatformKey,
    accessToken: string,
  ): Promise<{
    accessToken: string;
    pageId: string | null;
    pageName: string | null;
    extra: Record<string, any>;
  }> {
    try {
      if (platform === 'facebook') {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
        );
        const json: any = await res.json();
        const page = json?.data?.[0];
        if (page?.access_token) {
          return {
            accessToken: page.access_token, // token de PAGE pour publier
            pageId: page.id || null,
            pageName: page.name || null,
            extra: { ig_user_id: page.instagram_business_account?.id || null },
          };
        }
      } else if (platform === 'linkedin') {
        const res = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const ui: any = await res.json();
        if (ui?.sub) {
          return {
            accessToken,
            pageId: `urn:li:person:${ui.sub}`,
            pageName: ui.name || null,
            extra: { sub: ui.sub },
          };
        }
      }
    } catch (e) {
      this.logger.warn(`resolveAccount ${platform}: ${(e as Error).message}`);
    }
    return { accessToken, pageId: null, pageName: null, extra: {} };
  }

  /** Back-office : enregistre les identifiants d'app d'un tenant pour une plateforme. */
  async saveConfig(
    tenantId: string,
    platform: PlatformKey,
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    const { data } = await (this.supabase.client as any)
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();
    const metadata = data?.metadata || {};
    metadata.social_apps = metadata.social_apps || {};
    metadata.social_apps[platform] = {
      ...(metadata.social_apps[platform] || {}),
      ...(clientId ? { client_id: clientId } : {}),
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    };
    await (this.supabase.client as any)
      .from('tenants')
      .update({ metadata })
      .eq('id', tenantId);
    this.logger.log(`Config app ${platform} enregistrée (tenant ${tenantId})`);
  }

  /** Back-office : statut par plateforme (configurée ? connectée ?). Sans secret. */
  async getStatus(tenantId: string): Promise<
    Array<{ platform: PlatformKey; configured: boolean; connected: boolean }>
  > {
    const { data: t } = await (this.supabase.client as any)
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();
    const apps = (t?.metadata?.social_apps as any) || {};
    const { data: tokens } = await (this.supabase.client as any)
      .from('social_tokens')
      .select('platform')
      .eq('tenant_id', tenantId);
    const connected = new Set((tokens || []).map((x: any) => x.platform));
    return (Object.keys(PLATFORMS) as PlatformKey[]).map((p) => ({
      platform: p,
      configured: Boolean(apps[p]?.client_id),
      connected: connected.has(p),
    }));
  }
}
