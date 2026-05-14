import { randomUUID } from 'crypto';
import {
  ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException,
} from '@nestjs/common';
import { LiveKitService } from '../livekit/livekit.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuthUser } from '../auth/current-user.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateLiveDto } from './create-live.dto';
import type { AnswerQuestionDto, AskQuestionDto, SendChatDto } from './dto/live-chat.dto';

const HOST_ROLES = ['owner', 'admin', 'teacher'];
const LIVE_COLUMNS = 'id, title, description, scheduled_at, price_cents, currency, capacity, status, replay_enabled, livekit_room_name, host_user_id, created_at, updated_at';
type LiveRecord = { id: string; title: string; description: string | null; scheduled_at: string; price_cents: number; currency: string; capacity: number | null; status: string; replay_enabled: boolean; livekit_room_name: string; host_user_id: string; created_at: string; updated_at: string; };

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);
  constructor(private readonly supabase: SupabaseService, private readonly livekit: LiveKitService) {}

  async create(dto: CreateLiveDto, userId: string, tenant: TenantContext) {
    if (!HOST_ROLES.includes(tenant.userRole)) throw new ForbiddenException('Seuls owner, admin et teacher peuvent créer un live');
    const roomName = `${tenant.slug}_${randomUUID()}`;
    const { data, error } = await this.supabase.client.from('live_sessions').insert({
      tenant_id: tenant.id, host_user_id: userId, title: dto.title, description: dto.description ?? null,
      scheduled_at: dto.scheduledAt, price_cents: dto.priceCents, currency: dto.currency ?? 'EUR',
      capacity: dto.capacity ?? null, replay_enabled: dto.replayEnabled ?? false,
      livekit_room_name: roomName, status: 'scheduled',
    }).select(LIVE_COLUMNS).single();
    if (error) throw new InternalServerErrorException('Erreur interne');
    await this.livekit.ensureRoom(roomName, data.id, userId).catch(e => this.logger.error('ensureRoom', (e as Error).message));
    return data;
  }

  async findAll(tenantId: string, limit = 20, offset = 0) {
    const { data } = await this.supabase.client.from('live_sessions').select(LIVE_COLUMNS).eq('tenant_id', tenantId).order('scheduled_at', { ascending: true }).range(offset, offset + Math.min(limit, 100) - 1);
    return data ?? [];
  }

  async findOne(id: string, tenantId: string) {
    const { data, error } = await this.supabase.client.from('live_sessions').select(LIVE_COLUMNS).eq('id', id).eq('tenant_id', tenantId).single();
    if (error || !data) throw new NotFoundException(`Live "${id}" introuvable`);
    return data;
  }

  async getJoinToken(liveId: string, user: AuthUser, tenant: TenantContext) {
    const live = await this.findOne(liveId, tenant.id);
    if (live.status === 'cancelled' || live.status === 'ended') throw new ForbiddenException(`Le live est ${live.status}`);
    const isHost = HOST_ROLES.includes(tenant.userRole);
    await this.livekit.ensureRoom(live.livekit_room_name, liveId, live.host_user_id).catch(e => this.logger.error('ensureRoom', (e as Error).message));
    if (!isHost) {
      const now = new Date().toISOString();
      const { data: pass } = await this.supabase.client.from('access_passes').select('id').eq('tenant_id', tenant.id).eq('user_id', user.id).eq('resource_type', 'live_session').eq('resource_id', liveId).eq('status', 'active').or(`expires_at.is.null,expires_at.gte.${now}`).maybeSingle();
      if (!pass) throw new ForbiddenException('Accès au live non autorisé');
    }
    const token = isHost ? await this.livekit.generateHostToken(live.livekit_room_name, user.id, user.email) : await this.livekit.generateParticipantToken(live.livekit_room_name, user.id, user.email);
    return { token, roomName: live.livekit_room_name };
  }

  // ── Chat / Questions / Transcript / Participants ────────────────────────
  async sendChatMessage(liveId: string, tenant: TenantContext, userId: string, dto: SendChatDto) {
    await this.findOne(liveId, tenant.id);
    const { data } = await (this.supabase.client as any).from('live_chat_messages').insert({ tenant_id: tenant.id, live_session_id: liveId, user_id: userId, content: dto.content }).select('*').single();
    return data;
  }
  async getChatMessages(liveId: string, tenantId: string, limit = 50) { const { data } = await (this.supabase.client as any).from('live_chat_messages').select('*').eq('live_session_id', liveId).eq('tenant_id', tenantId).order('created_at').limit(limit); return data ?? []; }
  async askQuestion(liveId: string, tenant: TenantContext, userId: string, dto: AskQuestionDto) { await this.findOne(liveId, tenant.id); const { data } = await (this.supabase.client as any).from('live_questions').insert({ tenant_id: tenant.id, live_session_id: liveId, user_id: userId, content: dto.content, category: dto.category ?? 'general', status: 'open' }).select('*').single(); return data; }
  async getQuestions(liveId: string, tenantId: string) { const { data } = await (this.supabase.client as any).from('live_questions').select('*').eq('live_session_id', liveId).eq('tenant_id', tenantId).order('created_at'); return data ?? []; }
  async answerQuestion(liveId: string, questionId: string, tenantId: string, userId: string, dto: AnswerQuestionDto) { const { data } = await (this.supabase.client as any).from('live_questions').update({ answer: dto.content, answered_by: userId, answered_at: new Date().toISOString(), status: 'answered' }).eq('id', questionId).eq('live_session_id', liveId).eq('tenant_id', tenantId).select('*').single(); if (!data) throw new NotFoundException('Question introuvable'); return data; }
  async getTranscript(liveId: string, tenantId: string) { const { data } = await (this.supabase.client as any).from('live_sessions').select('transcript, summary').eq('id', liveId).eq('tenant_id', tenantId).single(); return data ?? {}; }
  async saveSummary(liveId: string, tenantId: string, summary: string) { await (this.supabase.client as any).from('live_sessions').update({ summary }).eq('id', liveId).eq('tenant_id', tenantId); }
  async markParticipantJoined(liveId: string, tenantId: string, userId: string) { await (this.supabase.client as any).from('live_session_participants').upsert({ tenant_id: tenantId, live_session_id: liveId, user_id: userId, role: 'student', joined_at: new Date().toISOString() }, { onConflict: 'live_session_id,user_id' }); }
  async markParticipantLeft(liveId: string, tenantId: string, userId: string) { await (this.supabase.client as any).from('live_session_participants').update({ left_at: new Date().toISOString() }).eq('live_session_id', liveId).eq('user_id', userId).eq('tenant_id', tenantId); }
  async getParticipants(liveId: string, tenantId: string) { const { data } = await (this.supabase.client as any).from('live_session_participants').select('*').eq('live_session_id', liveId).eq('tenant_id', tenantId); return data ?? []; }

  // ── Live Scripts ─────────────────────────────────────────────────────────
  async saveScript(liveId: string, tenantId: string, sections: any[]) {
    await (this.supabase.client as any).from('live_scripts').delete().eq('live_session_id', liveId).eq('tenant_id', tenantId);
    for (const s of sections) {
      await (this.supabase.client as any).from('live_scripts').insert({ tenant_id: tenantId, live_session_id: liveId, title: s.title, content: s.content, duration_seconds: s.duration ?? 0, order_index: s.orderIndex ?? 0 });
    }
    return { sections: sections.length };
  }
  async getScript(liveId: string, tenantId: string) {
    const { data } = await (this.supabase.client as any).from('live_scripts').select('*').eq('live_session_id', liveId).eq('tenant_id', tenantId).order('order_index');
    return data ?? [];
  }

  // ── Waiting Room ─────────────────────────────────────────────────────────
  async getWaitingRoom(liveId: string, tenantId: string) {
    const { data: live } = await (this.supabase.client as any).from('live_sessions').select('title, scheduled_at, status').eq('id', liveId).eq('tenant_id', tenantId).single();
    const { data: participants } = await (this.supabase.client as any).from('live_session_participants').select('user_id, joined_at').eq('live_session_id', liveId).eq('tenant_id', tenantId);
    return { ...live, participantCount: participants?.length ?? 0, participants: participants ?? [] };
  }
  async admitToRoom(liveId: string, tenantId: string, userId: string) {
    await this.markParticipantJoined(liveId, tenantId, userId);
    const live = await this.findOne(liveId, tenantId);
    const token = await this.livekit.generateParticipantToken(live.livekit_room_name, userId, 'participant');
    return { admitted: true, token, roomName: live.livekit_room_name };
  }

  // ── Debate Arena ─────────────────────────────────────────────────────────
  async createDebate(tenantId: string, userId: string, dto: { topic: string; sideA: string; sideB: string; scheduledAt: string }) {
    const { data } = await (this.supabase.client as any).from('debates').insert({
      tenant_id: tenantId, created_by: userId, topic: dto.topic, side_a: dto.sideA, side_b: dto.sideB,
      scheduled_at: dto.scheduledAt, status: 'scheduled',
    }).select('*').single();
    return data;
  }
  async listDebates(tenantId: string) { const { data } = await (this.supabase.client as any).from('debates').select('*').eq('tenant_id', tenantId).order('scheduled_at'); return data ?? []; }
  async getDebate(tenantId: string, id: string) { const { data } = await (this.supabase.client as any).from('debates').select('*').eq('id', id).eq('tenant_id', tenantId).single(); if (!data) throw new NotFoundException('Débat introuvable'); return data; }
  async submitVote(tenantId: string, debateId: string, userId: string, side: string) {
    await (this.supabase.client as any).from('debate_votes').upsert({ tenant_id: tenantId, debate_id: debateId, user_id: userId, side }, { onConflict: 'debate_id,user_id' });
    return { voted: side };
  }
  async getDebateResults(tenantId: string, debateId: string) {
    const { data } = await (this.supabase.client as any).from('debate_votes').select('side').eq('debate_id', debateId).eq('tenant_id', tenantId);
    const counts: Record<string, number> = {};
    for (const v of (data ?? [])) counts[v.side] = (counts[v.side] ?? 0) + 1;
    return counts;
  }

  // ── Immersive Live ───────────────────────────────────────────────────────

  async createImmersiveRoom(tenantId: string, hostId: string, guestId: string) {
    const roomName = `immersive_${tenantId.slice(0, 8)}_${randomUUID().slice(0, 8)}`;
    await this.livekit.ensureRoom(roomName, hostId, hostId);
    const { data } = await (this.supabase.client as any).from('immersive_live_sessions').insert({
      tenant_id: tenantId, host_user_id: hostId, guest_user_id: guestId,
      livekit_room_name: roomName, status: 'created',
    }).select('*').single();
    return data;
  }

  async getImmersiveToken(sessionId: string, userId: string, tenantId: string) {
    const { data: session } = await (this.supabase.client as any).from('immersive_live_sessions')
      .select('*').eq('id', sessionId).eq('tenant_id', tenantId).single();
    if (!session) throw new NotFoundException('Session immersive introuvable');
    if (session.status === 'ended') throw new ForbiddenException('Session terminée');

    const isHost = userId === session.host_user_id;
    const token = isHost
      ? await this.livekit.generateHostToken(session.livekit_room_name, userId, 'host')
      : await this.livekit.generateParticipantToken(session.livekit_room_name, userId, 'guest');
    return { token, roomName: session.livekit_room_name, role: isHost ? 'host' : 'guest' };
  }

  async generateCompanionLink(sessionId: string, tenantId: string) {
    const { data: session } = await (this.supabase.client as any).from('immersive_live_sessions')
      .select('*').eq('id', sessionId).eq('tenant_id', tenantId).single();
    if (!session) throw new NotFoundException('Session immersive introuvable');

    const code = randomUUID().slice(0, 8);
    await (this.supabase.client as any).from('immersive_live_sessions').update({
      companion_code: code, companion_code_expires_at: new Date(Date.now() + 900_000).toISOString(),
    }).eq('id', sessionId);
    return { companionCode: code, expiresIn: 900, roomName: session.livekit_room_name };
  }

  async exchangeCompanionToken(sessionId: string, code: string, userId: string) {
    const { data: session } = await (this.supabase.client as any).from('immersive_live_sessions')
      .select('*').eq('id', sessionId).single();
    if (!session || session.companion_code !== code) throw new ForbiddenException('Code companion invalide');
    if (session.companion_code_expires_at && new Date(session.companion_code_expires_at) < new Date()) {
      throw new ForbiddenException('Code companion expiré');
    }

    const token = await this.livekit.generateParticipantToken(session.livekit_room_name, userId, 'companion');
    await (this.supabase.client as any).from('immersive_live_sessions').update({ companion_used: true }).eq('id', sessionId);
    return { token, roomName: session.livekit_room_name, role: 'companion' };
  }

  async generateMobileCameraLink(liveId: string, tenantId: string) {
    const live = await this.findOne(liveId, tenantId);
    const code = randomUUID().slice(0, 8);
    await (this.supabase.client as any).from('live_sessions').update({
      mobile_camera_code: code, mobile_camera_expires_at: new Date(Date.now() + 600_000).toISOString(),
    }).eq('id', liveId);
    return { mobileCode: code, expiresIn: 600, roomName: live.livekit_room_name };
  }

  async exchangeMobileCameraToken(liveId: string, code: string, userId: string, tenantId: string) {
    const live = await this.findOne(liveId, tenantId);
    if ((live as any).mobile_camera_code !== code) throw new ForbiddenException('Code caméra invalide');
    const token = await this.livekit.generateParticipantToken(live.livekit_room_name, userId, 'mobile_camera');
    return { token, roomName: live.livekit_room_name, role: 'camera' };
  }

  async startRecording(liveId: string, tenantId: string) {
    const live = await this.findOne(liveId, tenantId);
    const result = await this.livekit.startRecording(live.livekit_room_name, liveId, tenantId);
    await (this.supabase.client as any).from('live_sessions').update({ recording_status: 'recording' }).eq('id', liveId);
    return result;
  }

  async stopRecording(liveId: string, tenantId: string) {
    await this.livekit.stopRecording(liveId);
    await (this.supabase.client as any).from('live_sessions').update({ recording_status: 'completed' }).eq('id', liveId);
    return { status: 'completed' };
  }

  async sendInvitations(liveId: string, tenantId: string, emails: string[]) {
    const live = await this.findOne(liveId, tenantId);
    // In production, send via email engine. For now, log and return.
    this.logger.log(`Invitations envoyées pour ${live.title} à ${emails.length} destinataires`);
    return { sent: emails.length, liveTitle: live.title };
  }

  async immersiveContextSnapshot(sessionId: string, tenantId: string, snapshot: any) {
    await (this.supabase.client as any).from('immersive_live_sessions').update({
      context_snapshot: snapshot, updated_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('tenant_id', tenantId);
    return { saved: true };
  }
}
