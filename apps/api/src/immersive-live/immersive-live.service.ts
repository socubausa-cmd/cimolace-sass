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

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 1) CREATE ROOM (LiveKit) pour session immersive
  // ═══════════════════════════════════════════════════════════════════════════
  async createRoom(input: {
    tenantId: string;
    userId: string;
    liveSessionId: string;
    tenantSlug?: string;
  }) {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, tenant_id, tenants(slug)')
      .eq('id', input.liveSessionId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session introuvable');

    const slug = (session as any).tenants?.slug ?? input.tenantSlug ?? input.tenantId;
    const roomName = LiveKitService.scopedRoomName(slug, input.liveSessionId);

    await this.liveKit.ensureRoom(roomName, input.liveSessionId, input.userId);

    // Enregistrer dans immersive_live_sessions si pas déjà
    await (this.supabase.client as any)
      .from('immersive_live_sessions')
      .upsert({
        live_session_id: input.liveSessionId,
        room_name: roomName,
        created_by: input.userId,
      }, { onConflict: 'live_session_id' });

    return {
      room_name: roomName,
      live_session_id: input.liveSessionId,
      livekit_url: this.liveKit.getUrl(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2) GET TOKEN LiveKit (host ou viewer selon le rôle)
  // ═══════════════════════════════════════════════════════════════════════════
  async getToken(input: {
    tenantId: string;
    userId: string;
    userName?: string;
    liveSessionId: string;
    role?: 'host' | 'viewer';
  }) {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, tenant_id, host_user_id, tenants(slug)')
      .eq('id', input.liveSessionId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session introuvable');

    const slug = (session as any).tenants?.slug ?? input.tenantId;
    const roomName = LiveKitService.scopedRoomName(slug, input.liveSessionId);

    await this.liveKit.ensureRoom(roomName, input.liveSessionId, input.userId);

    const isHost =
      input.role === 'host' || session.host_user_id === input.userId;
    const token = isHost
      ? await this.liveKit.generateHostToken(roomName, input.userId, input.userName)
      : await this.liveKit.generateParticipantToken(roomName, input.userId, input.userName);

    return {
      token,
      room_name: roomName,
      role: isHost ? 'host' : 'viewer',
      livekit_url: this.liveKit.getUrl(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3) CREATE COMPANION LINK (lien magique pour mobile companion)
  // ═══════════════════════════════════════════════════════════════════════════
  async createCompanionLink(input: {
    tenantId: string;
    userId: string;
    liveSessionId: string;
    origin?: string;
  }) {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, tenant_id, tenants(slug)')
      .eq('id', input.liveSessionId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session introuvable');

    // Générer un token opaque hex 32
    const opaqueToken = require('crypto').randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    await (this.supabase.client as any)
      .from('immersive_live_companion_tokens')
      .insert({
        token: opaqueToken,
        live_session_id: input.liveSessionId,
        owner_user_id: input.userId,
        expires_at: expiresAt,
        status: 'pending',
      });

    const baseUrl = input.origin || this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const slug = (session as any).tenants?.slug ?? '';
    const companionUrl = `${baseUrl}/m/companion?t=${opaqueToken}&tenant=${encodeURIComponent(slug)}&session=${input.liveSessionId}`;

    return {
      token: opaqueToken,
      companion_url: companionUrl,
      expires_at: expiresAt,
      expires_in: 1800,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4) COMPANION EXCHANGE (token opaque mobile → token LiveKit)
  // ═══════════════════════════════════════════════════════════════════════════
  async companionExchange(input: { token: string; displayName?: string }) {
    const { data: row } = await (this.supabase.client as any)
      .from('immersive_live_companion_tokens')
      .select('*')
      .eq('token', input.token)
      .maybeSingle();

    if (!row) throw new NotFoundException('Token invalide');
    if (row.status !== 'pending') {
      throw new ForbiddenException(`Token déjà ${row.status}`);
    }
    if (new Date(row.expires_at) < new Date()) {
      await (this.supabase.client as any)
        .from('immersive_live_companion_tokens')
        .update({ status: 'expired' })
        .eq('token', input.token);
      throw new ForbiddenException('Token expiré');
    }

    // Marquer comme consommé
    await (this.supabase.client as any)
      .from('immersive_live_companion_tokens')
      .update({ status: 'used', consumed_at: new Date().toISOString() })
      .eq('token', input.token);

    // Récupérer le slug tenant via session
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, tenants(slug)')
      .eq('id', row.live_session_id)
      .maybeSingle();

    const slug = (session as any)?.tenants?.slug ?? row.live_session_id;
    const roomName = LiveKitService.scopedRoomName(slug, row.live_session_id);
    const identity = `companion-${row.owner_user_id}-${Date.now()}`;

    await this.liveKit.ensureRoom(roomName, row.live_session_id, identity);
    const token = await this.liveKit.generateParticipantToken(
      roomName,
      identity,
      input.displayName ?? 'Companion',
    );

    return {
      livekit_token: token,
      room_name: roomName,
      live_session_id: row.live_session_id,
      livekit_url: this.liveKit.getUrl(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) PARTICIPANT LEAVE
  // ═══════════════════════════════════════════════════════════════════════════
  async participantLeave(input: { tenantId: string; userId: string; liveSessionId: string }) {
    await (this.supabase.client as any)
      .from('immersive_live_signals')
      .insert({
        live_session_id: input.liveSessionId,
        signal_type: 'participant_leave',
        sender_id: input.userId,
        payload: { tenant_id: input.tenantId, leftAt: new Date().toISOString() },
      });
    return { left: true };
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
