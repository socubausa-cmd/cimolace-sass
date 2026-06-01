/**
 * LiriPublicService — API publique LIRI v1.
 *
 * Authentifiée par X-Liri-Api-Key (ApiKeyGuard).
 * Utilisée par les sites externes (WordPress, Wix, apps custom)
 * pour gérer des sessions live sans compte Supabase.
 *
 * Fonctionnalités :
 *   - CRUD live sessions
 *   - Démarrer / terminer une session
 *   - Générer des embed tokens pour viewer | co_host | host
 *   - Gestion de la salle d'attente (admit / reject)
 *   - CRUD clés API
 *   - CRUD webhooks (via WebhookService)
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LiveKitService } from '../livekit/livekit.service';
import { WebhookService, LiriWebhookEvent } from './webhook.service';
import {
  EMBED_TOKEN_TTL_SECONDS,
  LiveEmbedRole,
  LiveEmbedTokenPayload,
} from '../live/embed/live-embed.types';

// Types disponibles selon la contrainte CHECK de la DB live_sessions
// Ajouter de nouveaux types via migration: ALTER TABLE live_sessions DROP CONSTRAINT ... ADD CONSTRAINT ...
export type SessionType =
  | 'class'
  | 'webinar'
  | 'workshop'
  | 'consultation'    // nécessite migration DB si pas encore autorisé
  | 'debate'          // nécessite migration DB si pas encore autorisé
  | 'commercial'      // nécessite migration DB si pas encore autorisé
  | 'masterclass';    // nécessite migration DB si pas encore autorisé

@Injectable()
export class LiriPublicService {
  private readonly logger = new Logger(LiriPublicService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly liveKit: LiveKitService,
    private readonly webhooks: WebhookService,
  ) {}

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async createSession(
    tenantId: string,
    input: {
      title: string;
      description?: string;
      session_type?: SessionType;
      scheduled_at?: string;
      capacity?: number;
      price_cents?: number;
      currency?: string;
      replay_enabled?: boolean;
      config?: Record<string, unknown>;
      host_user_id?: string;
    },
  ) {
    // Résoudre le host_user_id — utilise le propriétaire du tenant si non fourni
    let hostUserId = input.host_user_id;
    if (!hostUserId) {
      const { data: tenant } = await (this.supabase.client as any)
        .from('tenants')
        .select('owner_user_id')
        .eq('id', tenantId)
        .maybeSingle();
      hostUserId = (tenant as any)?.owner_user_id ?? null;
    }

    const { data, error } = await (this.supabase.client as any)
      .from('live_sessions')
      .insert({
        tenant_id: tenantId,
        host_user_id: hostUserId,
        teacher_id: hostUserId,
        title: input.title,
        description: input.description ?? null,
        session_type: input.session_type ?? 'webinar',
        scheduled_at: input.scheduled_at ?? new Date().toISOString(),
        capacity: input.capacity ?? null,
        price_cents: input.price_cents ?? 0,
        currency: input.currency ?? 'EUR',
        replay_enabled: input.replay_enabled ?? true,
        config: input.config ?? {},
        status: 'scheduled',
        video_provider: 'livekit',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listSessions(tenantId: string, params?: {
    status?: string;
    session_type?: SessionType;
    limit?: number;
    offset?: number;
  }) {
    let q = (this.supabase.client as any)
      .from('live_sessions')
      .select('id, title, status, session_type, scheduled_at, capacity, price_cents, currency, started_at, ended_at, replay_enabled, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('scheduled_at', { ascending: false });

    if (params?.status) q = q.eq('status', params.status);
    if (params?.session_type) q = q.eq('session_type', params.session_type);
    if (params?.limit) q = q.limit(params.limit);
    if (params?.offset) q = q.range(params.offset, (params.offset ?? 0) + (params.limit ?? 20) - 1);

    const { data, count } = await q;
    return { sessions: data ?? [], total: count ?? 0 };
  }

  async getSession(tenantId: string, sessionId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) throw new NotFoundException('Session introuvable');
    return data;
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    patch: Partial<{
      title: string;
      description: string;
      scheduled_at: string;
      capacity: number;
      price_cents: number;
      replay_enabled: boolean;
      config: Record<string, unknown>;
    }>,
  ) {
    const { data, error } = await (this.supabase.client as any)
      .from('live_sessions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();

    if (error || !data) throw new NotFoundException('Session introuvable');
    return data;
  }

  async startSession(tenantId: string, sessionId: string) {
    const session = await this.getSession(tenantId, sessionId);
    if ((session as any).status === 'live') return session;
    if ((session as any).status === 'ended') {
      throw new BadRequestException('La session est déjà terminée');
    }

    const { data } = await (this.supabase.client as any)
      .from('live_sessions')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    // Fire webhook
    this.webhooks.emit(tenantId, 'session.started', {
      session_id: sessionId,
      title: (session as any).title,
    }).catch(() => {});

    return data;
  }

  async endSession(tenantId: string, sessionId: string) {
    const { data } = await (this.supabase.client as any)
      .from('live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    this.webhooks.emit(tenantId, 'session.ended', {
      session_id: sessionId,
    }).catch(() => {});

    return data;
  }

  async deleteSession(tenantId: string, sessionId: string) {
    const session = await this.getSession(tenantId, sessionId);
    if ((session as any).status === 'live') {
      throw new BadRequestException(
        'Impossible de supprimer une session en cours. Terminez-la d\'abord.',
      );
    }
    await (this.supabase.client as any)
      .from('live_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('tenant_id', tenantId);
  }

  // ─── Embed Tokens ─────────────────────────────────────────────────────────

  /**
   * Génère un embed token pour n'importe quel rôle.
   * Appelé avec X-Liri-Api-Key — pas besoin de vérifier l'Origin
   * (la sécurité vient de la clé API).
   */
  async generateEmbedToken(
    tenantId: string,
    tenantSlug: string,
    sessionId: string,
    role: LiveEmbedRole,
    displayName?: string,
  ) {
    const session = await this.getSession(tenantId, sessionId);

    const secret = this.config.get<string>('LIRI_EMBED_JWT_SECRET');
    if (!secret || secret === 'replace_me') {
      throw new Error('LIRI_EMBED_JWT_SECRET non configuré');
    }

    const payload: LiveEmbedTokenPayload = {
      tenant_id: tenantId,
      session_id: sessionId,
      role,
      origin: '*',            // API key flow — pas de restriction d'Origin
      iss: 'cimolace-liri-embed',
    };

    // Le host a un TTL plus long (4h pour une session longue)
    const ttl = role === 'host' ? 4 * 3600 : EMBED_TOKEN_TTL_SECONDS;

    const embedToken = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: ttl,
    });

    const frontendBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    // URL iframe inclut le rôle et optionnellement le displayName
    const displayParam = displayName
      ? `&display=${encodeURIComponent(displayName)}`
      : '';

    return {
      embed_token: embedToken,
      iframe_url: `${frontendBase}/embed/live/${sessionId}?et=${encodeURIComponent(embedToken)}&tenant=${encodeURIComponent(tenantSlug)}&role=${role}${displayParam}`,
      expires_in: ttl,
      session_title: (session as any).title ?? 'Live',
      session_status: (session as any).status ?? 'scheduled',
      role,
    };
  }

  // ─── Waiting Room ─────────────────────────────────────────────────────────

  async getWaitingRoom(tenantId: string, sessionId: string) {
    await this.getSession(tenantId, sessionId);
    const { data } = await (this.supabase.client as any)
      .from('live_waiting_room')
      .select('id, user_id, display_name, status, requested_at, profiles(full_name, avatar_url)')
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .order('requested_at', { ascending: true });
    return data ?? [];
  }

  async admitFromWaitingRoom(tenantId: string, sessionId: string, waitingId: string) {
    await this.getSession(tenantId, sessionId);
    const { data } = await (this.supabase.client as any)
      .from('live_waiting_room')
      .update({ status: 'admitted', admitted_at: new Date().toISOString() })
      .eq('id', waitingId)
      .eq('session_id', sessionId)
      .select('*')
      .single();
    return data;
  }

  async rejectFromWaitingRoom(tenantId: string, sessionId: string, waitingId: string) {
    await this.getSession(tenantId, sessionId);
    const { data } = await (this.supabase.client as any)
      .from('live_waiting_room')
      .update({ status: 'rejected' })
      .eq('id', waitingId)
      .eq('session_id', sessionId)
      .select('*')
      .single();
    return data;
  }

  // ─── Recordings ───────────────────────────────────────────────────────────

  async listRecordings(tenantId: string, sessionId?: string) {
    let q = (this.supabase.client as any)
      .from('live_recordings')
      .select('id, session_id, file_url, duration_seconds, file_size_bytes, status, completed_at, live_sessions!inner(tenant_id, title)')
      .eq('live_sessions.tenant_id', tenantId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (sessionId) q = q.eq('session_id', sessionId);

    const { data } = await q;
    return data ?? [];
  }

  // ─── API Keys (gestion par le back-office tenant) ─────────────────────────

  async listApiKeys(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .select('id, label, key_prefix, last_used_at, revoked_at, created_at')
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async createApiKey(tenantId: string, label: string): Promise<{
    id: string;
    key: string; // Affiché UNE SEULE FOIS
    key_prefix: string;
    label: string;
  }> {
    const rawKey = `lk_live_${randomBytes(24).toString('hex')}`;
    const hash = createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 18); // lk_live_ + 10 chars

    const { data, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .insert({
        tenant_id: tenantId,
        label,
        key_prefix: prefix,
        key_hash: hash,
      })
      .select('id, label, key_prefix')
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      ...(data as any),
      key: rawKey, // ← affiché une seule fois, pas stocké
    };
  }

  async revokeApiKey(tenantId: string, keyId: string) {
    await (this.supabase.client as any)
      .from('tenant_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('tenant_id', tenantId);
  }

  // ─── Participants actifs (LiveKit) ────────────────────────────────────────

  async listParticipants(tenantId: string, sessionId: string, tenantSlug: string) {
    const roomName = LiveKitService.scopedRoomName(tenantSlug, sessionId);
    try {
      // On n'a pas accès direct à RoomServiceClient ici, on retourne les infos de la session
      // L'API LiveKit pour lister les participants est disponible via LIRI dashboard
      const session = await this.getSession(tenantId, sessionId);
      return {
        room_name: roomName,
        session_status: (session as any).status,
        note: 'Utilisez le dashboard LIRI pour voir les participants en temps réel',
      };
    } catch {
      return { room_name: roomName, participants: [] };
    }
  }

  // ─── Tenant info ──────────────────────────────────────────────────────────

  async getTenantBySlug(slug: string) {
    const { data } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, slug, name, status')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    return data;
  }
}
