import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import { LiveKitService } from '../../livekit/livekit.service';
import {
  EMBED_TOKEN_TTL_SECONDS,
  LiveEmbedRole,
  LiveEmbedTokenPayload,
} from './live-embed.types';

@Injectable()
export class LiveEmbedService {
  private readonly logger = new Logger(LiveEmbedService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly liveKit: LiveKitService,
  ) {}

  // ─── 1. Émettre un embed token (appelé par le widget JS sur le site client) ──

  /**
   * Vérifie que l'Origin est whitelistée dans tenant_domains pour ce tenant,
   * puis signe un JWT court-vivant (30 min) autorisant l'accès à la session.
   *
   * Sécurité : l'Origin est injectée par le navigateur → impossible à spoofer
   * depuis un site tiers grâce au preflight CORS. La validation Origin est le
   * seul facteur d'authentification pour ce flow public (pas de clé secrète
   * côté client).
   */
  async issueEmbedToken(input: {
    tenantSlug: string;
    sessionId: string;
    origin: string | undefined;
    role?: LiveEmbedRole;
  }): Promise<{
    embed_token: string;
    iframe_url: string;
    expires_in: number;
    session_title: string;
    session_status: string;
  }> {
    const { tenantSlug, sessionId, origin, role = 'viewer' } = input;

    if (!origin) {
      throw new ForbiddenException(
        'Header Origin manquant — embed token refusé. ' +
        'Assurez-vous que le widget est appelé depuis un navigateur.',
      );
    }

    const originHost = this.extractHost(origin.toLowerCase());

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
      throw new ForbiddenException(
        `Tenant "${tenantSlug}" inactif — embed non autorisé`,
      );
    }

    // 2. Vérifier que l'Origin est whitelistée pour ce tenant
    const { data: domains, error: dErr } = await (this.supabase.client as any)
      .from('tenant_domains')
      .select('domain, status')
      .eq('tenant_id', (tenant as any).id)
      .eq('usage', 'embed_origin')
      .eq('status', 'active');

    if (dErr) {
      this.logger.error('tenant_domains lookup failed', dErr.message);
      throw new InternalServerErrorException(
        'Impossible de vérifier les origines autorisées',
      );
    }

    const allowedHosts = ((domains ?? []) as Array<{ domain: string }>)
      .map((d) => d.domain.toLowerCase());

    // En dev local, on autorise toujours localhost
    const isLocalDev = originHost.startsWith('localhost') || originHost.startsWith('127.0.0.1');
    const isDevMode = this.config.get<string>('NODE_ENV') !== 'production';
    // Origin '*' = émis par le flow API key (LiriPublicService) — toujours autorisé
    const isApiKeyFlow = origin === '*';

    if (!isApiKeyFlow && !allowedHosts.includes(originHost) && !(isLocalDev && isDevMode)) {
      throw new ForbiddenException(
        `Origin "${origin}" non autorisée pour le tenant "${tenantSlug}". ` +
        'Ajoutez ce domaine dans les paramètres embed de votre école.',
      );
    }

    // 3. Vérifier que la session appartient au tenant et récupérer ses métadonnées
    const { data: session, error: sErr } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, title, status, tenant_id, scheduled_at')
      .eq('id', sessionId)
      .eq('tenant_id', (tenant as any).id)
      .maybeSingle();

    if (sErr || !session) {
      throw new NotFoundException(
        `Session "${sessionId}" introuvable pour ce tenant`,
      );
    }

    // 4. Signer le JWT
    const secret = this.config.get<string>('LIRI_EMBED_JWT_SECRET');
    if (!secret || secret === 'replace_me') {
      throw new InternalServerErrorException(
        'LIRI_EMBED_JWT_SECRET non configuré',
      );
    }

    // SÉCURITÉ (anti-escalade) : le rôle demandé n'est HONORÉ que pour le flux
    // API-key (origin '*', émis serveur-à-serveur par un porteur de clé tenant —
    // donc de confiance). Pour le flux NAVIGATEUR (widget public gaté seulement
    // par l'Origin, partagée par TOUS les visiteurs du site), on FORCE 'viewer' :
    // sinon n'importe quel spectateur anonyme pouvait demander 'co_host' et
    // obtenir un token canPublish (publier caméra/micro dans le live). Un vrai
    // co-présentateur passe par un chemin authentifié, jamais par ce widget.
    const effectiveRole: LiveEmbedRole = isApiKeyFlow ? role : 'viewer';
    if (effectiveRole !== role) {
      this.logger.warn(
        `embed token: rôle "${role}" demandé sur flux navigateur (origin=${originHost}) → forcé à "viewer" (anti-escalade).`,
      );
    }

    const payload: LiveEmbedTokenPayload = {
      tenant_id: (tenant as any).id,
      session_id: sessionId,
      role: effectiveRole,
      origin: origin.toLowerCase(),
      iss: 'cimolace-liri-embed',
    };

    const embedToken = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: EMBED_TOKEN_TTL_SECONDS,
    });

    const frontendBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    return {
      embed_token: embedToken,
      iframe_url: `${frontendBase}/embed/live/${sessionId}?et=${encodeURIComponent(embedToken)}&tenant=${encodeURIComponent(tenantSlug)}`,
      expires_in: EMBED_TOKEN_TTL_SECONDS,
      session_title: (session as any).title ?? 'Live',
      session_status: (session as any).status ?? 'scheduled',
    };
  }

  // ─── 2. Rejoindre une session depuis l'iframe (échange embed token → LiveKit token) ──

  /**
   * Valide le payload d'un embed token déjà vérifié par LiveEmbedTokenGuard,
   * crée la room LiveKit si nécessaire et retourne un token LiveKit participant.
   */
  async joinSession(
    payload: LiveEmbedTokenPayload,
    sessionId: string,
  ): Promise<{
    livekit_token: string;
    room_name: string;
    session_title: string;
    session_status: string;
    role: string;
  }> {
    if (payload.session_id !== sessionId) {
      throw new ForbiddenException(
        'Le token embed ne correspond pas à cette session',
      );
    }

    // Récupérer les infos de la session
    const { data: session, error } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, title, status, tenant_id, tenants(slug)')
      .eq('id', sessionId)
      .eq('tenant_id', payload.tenant_id)
      .maybeSingle();

    if (error || !session) {
      throw new NotFoundException('Session introuvable');
    }

    const tenantSlug = (session as any).tenants?.slug ?? payload.tenant_id;
    const roomName = LiveKitService.scopedRoomName(tenantSlug, sessionId);

    // Créer la room si elle n'existe pas encore (idempotent)
    try {
      await this.liveKit.ensureRoom(
        roomName,
        sessionId,
        `embed-${payload.role}-${Date.now()}`,
      );
    } catch (err) {
      // Si la session n'est pas encore démarrée, ensureRoom peut échouer — on continue
      this.logger.warn(`ensureRoom skipped: ${(err as Error).message}`);
    }

    // Générer le token LiveKit selon le rôle
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);

    let livekitToken: string;
    if (payload.role === 'host') {
      const hostIdentity = `embed-host-${ts}-${rand}`;
      livekitToken = await this.liveKit.generateHostToken(roomName, hostIdentity, 'Hôte');
    } else if (payload.role === 'co_host') {
      // co_host : peut publier caméra/micro mais pas roomAdmin
      const coHostIdentity = `embed-cohost-${ts}-${rand}`;
      // Réutilise generateHostToken (canPublish: true) — différenciation UI seulement
      livekitToken = await this.liveKit.generateHostToken(roomName, coHostIdentity, 'Co-hôte');
    } else {
      // viewer par défaut
      const viewerIdentity = `embed-viewer-${ts}-${rand}`;
      livekitToken = await this.liveKit.generateParticipantToken(roomName, viewerIdentity, 'Spectateur');
    }

    return {
      livekit_token: livekitToken,
      room_name: roomName,
      session_title: (session as any).title ?? 'Live',
      session_status: (session as any).status ?? 'scheduled',
      role: payload.role,
    };
  }

  // ─── 3. Infos publiques sur une session (sans auth) ─────────────────────────

  async getSessionInfo(tenantSlug: string, sessionId: string): Promise<{
    id: string;
    title: string;
    status: string;
    scheduled_at: string | null;
    tenant_slug: string;
  }> {
    const { data: session, error } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, title, status, scheduled_at, tenants!inner(slug)')
      .eq('id', sessionId)
      .eq('tenants.slug', tenantSlug)
      .maybeSingle();

    if (error || !session) {
      throw new NotFoundException('Session introuvable ou tenant incorrect');
    }

    return {
      id: (session as any).id,
      title: (session as any).title ?? 'Live',
      status: (session as any).status ?? 'scheduled',
      scheduled_at: (session as any).scheduled_at ?? null,
      tenant_slug: tenantSlug,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private extractHost(origin: string): string {
    try {
      return new URL(origin).host.toLowerCase();
    } catch {
      return origin.toLowerCase();
    }
  }
}
