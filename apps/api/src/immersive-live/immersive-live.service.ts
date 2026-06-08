/**
 * ImmersiveLiveService — port des 8 lambdas v1 :
 *   - createRoom           : crée la room LiveKit pour une session immersive
 *   - getToken             : émet token LiveKit pour rejoindre
 *   - createCompanionLink  : génère un lien magique mobile companion
 *   - companionExchange    : échange token opaque → token LiveKit
 *   - participantLeave     : marque la sortie d'un participant
 *   - contextSnapshot      : snapshot état utilisateur (RDV/threads/invites)
 *   - aiGuide              : assistant IA navigation site immersif
 *   - navTrack             : tracking événements navigation
 */

import { BadRequestException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LiveKitService } from '../livekit/livekit.service';
import { AiBillingService } from '../ai-billing/ai-billing.service';

@Injectable()
export class ImmersiveLiveService {
  private readonly logger = new Logger(ImmersiveLiveService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly liveKit: LiveKitService,
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
  ) {}

  // ── Helpers (port fidèle des lambdas v1) ────────────────────────────────────
  /** Room immersive — `immersive_<id avec _>` (inlined dans les lambdas v1). */
  private immersiveRoom(id: string): string {
    return `immersive_${String(id).replace(/-/g, '_')}`;
  }

  private async loadImmersiveSession(id: string) {
    const { data } = await (this.supabase.client as any)
      .from('immersive_live_sessions')
      .select('id, host_user_id, guest_user_id, status')
      .eq('id', id)
      .maybeSingle();
    return data as {
      id: string;
      host_user_id: string;
      guest_user_id: string | null;
      status: string;
    } | null;
  }

  private assertHostOrGuest(
    session: { host_user_id: string; guest_user_id: string | null },
    userId: string,
  ): void {
    if (session.host_user_id !== userId && session.guest_user_id !== userId) {
      throw new ForbiddenException('Accès refusé à cette session immersive');
    }
  }

  /** Trace présence (join/rejoin) dans immersive_live_participants. */
  private async upsertImmersiveParticipant(
    liveSessionId: string,
    userId: string,
    role: 'host' | 'participant',
  ): Promise<void> {
    const admin = this.supabase.client as any;
    const { data: existing } = await admin
      .from('immersive_live_participants')
      .select('id, left_at')
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId)
      .maybeSingle();
    const now = new Date().toISOString();
    if (!existing) {
      await admin.from('immersive_live_participants').insert({
        live_session_id: liveSessionId,
        user_id: userId,
        role,
        joined_at: now,
        left_at: null,
      });
    } else if (existing.left_at) {
      await admin
        .from('immersive_live_participants')
        .update({ joined_at: now, left_at: null, role })
        .eq('id', existing.id);
    } else {
      await admin.from('immersive_live_participants').update({ role }).eq('id', existing.id);
    }
  }

  private async profileMeta(
    userId: string,
  ): Promise<{ name?: string; extra: Record<string, unknown> }> {
    const { data } = await (this.supabase.client as any)
      .from('profiles')
      .select('name, avatar_url, city, region, country')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return { extra: {} };
    const extra: Record<string, unknown> = {};
    if (data.avatar_url) extra.avatarUrl = data.avatar_url;
    if (data.city) extra.city = data.city;
    if (data.region) extra.region = data.region;
    if (data.country) extra.country = data.country;
    return { name: data.name ?? undefined, extra };
  }

  private async isStaff(userId: string): Promise<boolean> {
    const { data } = await (this.supabase.client as any)
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    return ['owner', 'admin', 'secretariat'].includes(
      String(data?.role ?? '').toLowerCase(),
    );
  }

  /** Résout le nom de room d'un live "classique" comme le token host (même salle). */
  private liveRoomName(session: {
    livekit_room_name?: string | null;
    video_room_id?: string | null;
    tenants?: { slug?: string } | null;
    id: string;
  }, fallbackSlug?: string): string {
    const slug = session.tenants?.slug ?? fallbackSlug ?? '';
    return (
      session.livekit_room_name ||
      session.video_room_id ||
      LiveKitService.scopedRoomName(slug, session.id)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1) CREATE ROOM — session immersive (immersive_live_sessions, room immersive_<id>)
  // ═══════════════════════════════════════════════════════════════════════════
  async createRoom(input: {
    tenantId: string;
    userId: string;
    liveSessionId: string;
    tenantSlug?: string;
  }) {
    const session = await this.loadImmersiveSession(input.liveSessionId);
    if (!session) throw new NotFoundException('Session immersive introuvable');
    this.assertHostOrGuest(session, input.userId);
    if (session.status === 'ended') throw new BadRequestException('Session terminée');

    const roomName = this.immersiveRoom(session.id);
    await this.liveKit.ensureRoom(roomName, session.id, session.host_user_id);
    await (this.supabase.client as any)
      .from('immersive_live_sessions')
      .update({ room_name: roomName })
      .eq('id', session.id);

    return { ok: true, roomName, liveSessionId: session.id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2) GET TOKEN — rejoindre la session immersive (host ou invité)
  // ═══════════════════════════════════════════════════════════════════════════
  async getToken(input: {
    tenantId: string;
    userId: string;
    userName?: string;
    liveSessionId: string;
    role?: 'host' | 'viewer';
  }) {
    const session = await this.loadImmersiveSession(input.liveSessionId);
    if (!session) throw new NotFoundException('Session immersive introuvable');
    this.assertHostOrGuest(session, input.userId);
    if (session.status === 'ended') throw new BadRequestException('Session terminée');

    const isHost = session.host_user_id === input.userId;
    const roomName = this.immersiveRoom(session.id);
    await this.liveKit.ensureRoom(roomName, session.id, session.host_user_id);
    await this.upsertImmersiveParticipant(session.id, input.userId, isHost ? 'host' : 'participant');

    const profile = await this.profileMeta(input.userId);
    const token = await this.liveKit.generateRawToken({
      roomName,
      identity: input.userId,
      name: profile.name ?? input.userName,
      ttl: '30m',
      metadata: {
        liveSessionId: session.id,
        userId: input.userId,
        role: isHost ? 'host' : 'guest',
        mode: 'immersive-messaging',
        ...profile.extra,
      },
    });

    return { token, roomName, livekitUrl: this.liveKit.getUrl(), identity: input.userId };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3) CREATE COMPANION LINK — magic-link téléphone (session immersive active)
  // ═══════════════════════════════════════════════════════════════════════════
  async createCompanionLink(input: {
    tenantId: string;
    userId: string;
    liveSessionId: string;
    origin?: string;
  }) {
    const session = await this.loadImmersiveSession(input.liveSessionId);
    if (!session) throw new NotFoundException('Session immersive introuvable');
    this.assertHostOrGuest(session, input.userId);
    if (session.status !== 'active') throw new BadRequestException('La session doit être active');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await (this.supabase.client as any)
      .from('immersive_live_companion_tokens')
      .insert({ live_session_id: session.id, token, expires_at: expiresAt });

    const base = input.origin || this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return { joinUrl: `${base}/live/phone?t=${token}`, token, expiresAt };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4) COMPANION EXCHANGE — token opaque → token LiveKit (PUBLIC, usage unique)
  // ═══════════════════════════════════════════════════════════════════════════
  async companionExchange(input: { token: string; displayName?: string }) {
    const admin = this.supabase.client as any;
    const nowIso = new Date().toISOString();
    // Consommation ATOMIQUE : used_at NULL + non expiré → marque used_at + renvoie la ligne.
    const { data: row } = await admin
      .from('immersive_live_companion_tokens')
      .update({ used_at: nowIso })
      .eq('token', input.token)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('id, live_session_id')
      .maybeSingle();
    if (!row) throw new GoneException('Lien invalide, déjà utilisé ou expiré');

    const session = await this.loadImmersiveSession(row.live_session_id);
    if (!session || session.status !== 'active') {
      throw new BadRequestException('Session non active');
    }

    const roomName = this.immersiveRoom(row.live_session_id);
    const identity = `companion_${row.id}`;
    await this.liveKit.ensureRoom(roomName, row.live_session_id, identity);
    const token = await this.liveKit.generateRawToken({
      roomName,
      identity,
      name: input.displayName ?? 'Téléphone (QR)',
      ttl: '30m',
      metadata: { liveSessionId: row.live_session_id, companion: true, tokenRowId: row.id },
    });

    return { token, roomName, livekitUrl: this.liveKit.getUrl(), identity };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) PARTICIPANT LEAVE — marque left_at dans immersive_live_participants
  // ═══════════════════════════════════════════════════════════════════════════
  async participantLeave(input: { tenantId: string; userId: string; liveSessionId: string }) {
    const session = await this.loadImmersiveSession(input.liveSessionId);
    if (!session) throw new NotFoundException('Session immersive introuvable');
    this.assertHostOrGuest(session, input.userId);
    const admin = this.supabase.client as any;
    const { data: existing } = await admin
      .from('immersive_live_participants')
      .select('id, left_at')
      .eq('live_session_id', session.id)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (!existing || existing.left_at) return { ok: true, action: 'noop' };
    await admin
      .from('immersive_live_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { ok: true, action: 'left' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6) MOBILE-CAMERA LINK — magic-link "téléphone = caméra" (live classique en direct)
  // ═══════════════════════════════════════════════════════════════════════════
  async mobileCameraLink(input: {
    tenantId: string;
    tenantSlug: string;
    userId: string;
    liveSessionId: string;
    origin?: string;
  }) {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, teacher_id, status, livekit_room_name, video_room_id, tenants(slug)')
      .eq('id', input.liveSessionId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.status !== 'live') throw new BadRequestException('La session doit être en direct');
    if (session.teacher_id !== input.userId && !(await this.isStaff(input.userId))) {
      throw new ForbiddenException('Réservé au formateur');
    }

    const roomName = this.liveRoomName(session, input.tenantSlug);
    await this.liveKit.ensureRoom(roomName, session.id, session.teacher_id ?? input.userId);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    await (this.supabase.client as any)
      .from('live_mobile_camera_tokens')
      .insert({ live_session_id: session.id, token, expires_at: expiresAt });

    const base = input.origin || this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return { joinUrl: `${base}/live/mobile-camera?t=${token}`, token, expiresAt };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7) MOBILE-CAMERA EXCHANGE — token opaque → token LiveKit (PUBLIC, usage unique)
  // ═══════════════════════════════════════════════════════════════════════════
  async mobileCameraExchange(input: { token: string }) {
    const admin = this.supabase.client as any;
    const nowIso = new Date().toISOString();
    const { data: row } = await admin
      .from('live_mobile_camera_tokens')
      .update({ used_at: nowIso })
      .eq('token', input.token)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('id, live_session_id')
      .maybeSingle();
    if (!row) throw new GoneException('Lien invalide, déjà utilisé ou expiré');

    const { data: session } = await admin
      .from('live_sessions')
      .select('id, status, livekit_room_name, video_room_id, tenants(slug)')
      .eq('id', row.live_session_id)
      .maybeSingle();
    if (!session || session.status !== 'live') {
      throw new BadRequestException('Session non en direct');
    }

    const roomName = this.liveRoomName(session);
    await this.liveKit.ensureRoom(roomName, session.id, session.id);
    const identity = `liri_mobile_${String(row.id).replace(/-/g, '')}`;
    const token = await this.liveKit.generateRawToken({
      roomName,
      identity,
      name: 'Caméra mobile LIRI',
      ttl: '20m',
      metadata: {
        liveSessionId: row.live_session_id,
        liriMobileCamera: true,
        tokenRowId: row.id,
        role: 'liri_mobile',
      },
    });

    return { token, roomName, livekitUrl: this.liveKit.getUrl(), identity };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6) CONTEXT SNAPSHOT — état utilisateur (RDV pending, threads, invites)
  // ═══════════════════════════════════════════════════════════════════════════
  async contextSnapshot(userId: string | null) {
    if (!userId) {
      return {
        isAuthenticated: false,
        booking: { hasPending: false, hasConfirmed: false },
        conversations: { open: 0, escalated: 0 },
        invites: { pending: 0 },
      };
    }

    const [apptsRes, threadsRes, invitesRes] = await Promise.all([
      (this.supabase.client as any)
        .from('appointments')
        .select('status')
        .eq('student_id', userId)
        .in('status', ['pending', 'confirmed', 'scheduled'])
        .limit(20),
      (this.supabase.client as any)
        .from('conversation_threads')
        .select('status')
        .eq('visitor_id', userId)
        .in('status', ['open', 'qualified', 'escalated'])
        .limit(40),
      (this.supabase.client as any)
        .from('live_chat_invites')
        .select('status')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .limit(20),
    ]);

    const appts = apptsRes.data ?? [];
    const threads = threadsRes.data ?? [];
    const invites = invitesRes.data ?? [];

    return {
      isAuthenticated: true,
      booking: {
        hasPending: appts.some((a: any) => a.status === 'pending'),
        hasConfirmed: appts.some((a: any) => ['confirmed', 'scheduled'].includes(a.status)),
        count: appts.length,
      },
      conversations: {
        open: threads.filter((t: any) => t.status === 'open').length,
        qualified: threads.filter((t: any) => t.status === 'qualified').length,
        escalated: threads.filter((t: any) => t.status === 'escalated').length,
      },
      invites: { pending: invites.length },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7) AI GUIDE — assistant navigation IA
  // ═══════════════════════════════════════════════════════════════════════════
  async aiGuide(input: {
    tenantId: string | null;
    userId: string | null;
    message: string;
    siteMap?: Array<{ id: string; label: string; path: string; keywords?: string[]; summary?: string }>;
  }) {
    if (!input.message?.trim()) throw new BadRequestException('message requis');

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (!groqKey || groqKey === 'replace_me') {
      // Fallback heuristique : matcher contre le sitemap
      const found = this.findInSiteMap(input.message, input.siteMap ?? []);
      return {
        answer: found
          ? `Vous cherchez "${found.label}" — c'est sur la page ${found.path}.`
          : 'Je peux vous guider sur le site. Demandez-moi par exemple "tarifs", "rendez-vous" ou "formations".',
        suggestion: found,
        provider: 'heuristic',
      };
    }

    const siteMap = input.siteMap ?? this.defaultSiteMap();
    const sitemapText = siteMap
      .slice(0, 30)
      .map((s) => `- ${s.label} (${s.path}) ${s.summary ?? ''}`.trim())
      .join('\n');

    const prompt = `Tu es l'assistant immersif LIRI. Aide le visiteur à naviguer sur le site.

Sitemap disponible :
${sitemapText}

Question : "${input.message}"

Si la question correspond à une page, propose-la avec son chemin. Sinon réponds brièvement (3 phrases max).
Format JSON strict : { "answer": "...", "suggested_path": "/..." | null }
Pas de markdown, juste le JSON.`;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Assistant navigation LIRI.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 250,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const json = await res.json();
      const usage = json?.usage ?? {};
      const content = json?.choices?.[0]?.message?.content?.trim() ?? '{}';

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : {};
      }

      // Billing si tenant connu
      if (input.tenantId) {
        try {
          await this.billing.chargeUsage(input.tenantId, {
            function_name: 'immersive-ai-guide',
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
            unit_type: 'tokens_in',
            unit_amount: usage.prompt_tokens ?? 0,
            user_id: input.userId ?? undefined,
          });
          await this.billing.chargeUsage(input.tenantId, {
            function_name: 'immersive-ai-guide',
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
            unit_type: 'tokens_out',
            unit_amount: usage.completion_tokens ?? 0,
            user_id: input.userId ?? undefined,
          });
        } catch (_) { /* billing non bloquant */ }
      }

      const suggestedPath = parsed.suggested_path;
      const suggestion = suggestedPath
        ? siteMap.find((s) => s.path === suggestedPath)
        : null;

      return {
        answer: parsed.answer ?? 'Je peux vous guider — précisez votre besoin.',
        suggestion: suggestion ?? null,
        provider: 'groq',
      };
    } catch (err) {
      this.logger.warn(`AI guide failed: ${(err as Error).message}`);
      const found = this.findInSiteMap(input.message, siteMap);
      return {
        answer: found
          ? `Vous cherchez "${found.label}" — c'est sur la page ${found.path}.`
          : 'Je peux vous guider sur le site. Précisez votre besoin.',
        suggestion: found,
        provider: 'heuristic_fallback',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8) NAV TRACK — log événements navigation immersive
  // ═══════════════════════════════════════════════════════════════════════════
  async navTrack(input: {
    tenantId: string | null;
    userId: string | null;
    eventType: 'exposure' | 'click' | 'close';
    sessionId?: string;
    topActionId?: string;
    runtimeContext?: any;
    metadata?: any;
  }) {
    if (!['exposure', 'click', 'close'].includes(input.eventType)) {
      throw new BadRequestException('eventType invalide (exposure|click|close)');
    }

    await (this.supabase.client as any).from('immersive_navigation_events').insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      event_type: input.eventType,
      session_id: input.sessionId ?? null,
      top_action_id: input.topActionId ?? null,
      runtime_context: input.runtimeContext ?? {},
      metadata: input.metadata ?? {},
    });

    return { tracked: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private findInSiteMap(
    message: string,
    siteMap: Array<{ id: string; label: string; path: string; keywords?: string[]; summary?: string }>,
  ) {
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const m = norm(message);
    for (const item of siteMap) {
      if (norm(item.label).split(/\s+/).some((w) => m.includes(w) && w.length > 3)) {
        return item;
      }
      if ((item.keywords ?? []).some((k) => m.includes(norm(k)))) {
        return item;
      }
    }
    return null;
  }

  private defaultSiteMap() {
    return [
      { id: 'home', label: 'Accueil', path: '/', keywords: ['accueil', 'home'], summary: 'Page d\'entrée' },
      { id: 'forfaits', label: 'Forfaits', path: '/forfaits', keywords: ['prix', 'tarif', 'forfait', 'abonnement'], summary: 'Plans et tarifs' },
      { id: 'catalogue', label: 'Catalogue formations', path: '/formations/catalogue', keywords: ['cours', 'formation', 'module'], summary: 'Catalogue cours' },
      { id: 'booking', label: 'Prendre rendez-vous', path: '/appointment/request', keywords: ['rendez-vous', 'rdv', 'entretien'], summary: 'Réserver un RDV' },
      { id: 'about', label: 'À propos', path: '/a-propos', keywords: ['à propos', 'mission', 'vision'], summary: 'Notre histoire' },
      { id: 'chat', label: 'Messagerie', path: '/messages', keywords: ['chat', 'messages'], summary: 'Messagerie immersive' },
    ];
  }
}
