"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LiveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const livekit_service_1 = require("../livekit/livekit.service");
const liri_entitlements_service_1 = require("../billing/liri-entitlements.service");
const usage_service_1 = require("../usage/usage.service");
const member_tier_1 = require("../billing/member-tier");
let LiveService = LiveService_1 = class LiveService {
    constructor(auth, liveKit, entitlements, usage) {
        this.auth = auth;
        this.liveKit = liveKit;
        this.entitlements = entitlements;
        this.usage = usage;
        this.logger = new common_1.Logger(LiveService_1.name);
    }
    get supabase() { return this.auth.getClient(); }
    async createSession(tenantId, data) {
        const scheduledAt = data?.scheduled_at ? new Date(data.scheduled_at).getTime() : null;
        if (scheduledAt && Number.isFinite(scheduledAt) && scheduledAt > Date.now() + 2 * 60 * 60 * 1000) {
            const { limits } = await this.entitlements.resolveLimits(tenantId);
            if (!limits.canSchedule) {
                throw new common_1.ForbiddenException("Forfait gratuit : la programmation de lives à l'avance n'est pas incluse. Lancez un live immédiat, ou passez à un forfait LIRI pour planifier vos lives.");
            }
        }
        const COLS = [
            "host_user_id", "title", "description", "scheduled_at", "price_cents", "currency",
            "capacity", "replay_enabled", "teacher_id", "cover_image_url", "session_type",
            "formation_id", "config", "debate_id", "duration_minutes", "ambient_tracks_json",
            "join_code", "production_live_type", "production_category", "room_mode",
            "timezone", "access_mode", "kind",
        ];
        const row = {
            tenant_id: tenantId,
            status: "scheduled",
            scheduled_at: data?.scheduled_at || new Date().toISOString(),
        };
        for (const k of COLS)
            if (data?.[k] !== undefined)
                row[k] = data[k];
        if (row.session_type === "classe")
            row.session_type = "class";
        const ACCESS = ["public", "invite_only", "password", "subscription"];
        if (row.access_mode && !ACCESS.includes(String(row.access_mode)))
            delete row.access_mode;
        if (!row.host_user_id && data?.teacher_id)
            row.host_user_id = data.teacher_id;
        if (!row.teacher_id && row.host_user_id)
            row.teacher_id = row.host_user_id;
        const { data: session, error } = await this.supabase
            .from("live_sessions")
            .insert(row)
            .select()
            .single();
        if (error || !session) {
            throw new common_1.BadRequestException(`Création du live impossible : ${error?.message ?? "insert vide"}`);
        }
        const invited = Array.isArray(data?.invited_user_ids) ? data.invited_user_ids.filter(Boolean) : [];
        if (invited.length) {
            const participants = invited.map((uid) => ({
                live_session_id: session.id, user_id: uid, role: "student",
            }));
            const { error: pErr } = await this.supabase
                .from("live_session_participants")
                .upsert(participants, { onConflict: "live_session_id,user_id" });
            if (pErr)
                this.logger.warn(`participants: ${pErr.message}`);
        }
        if (data?.notify_dashboard !== undefined || data?.notify_email !== undefined || data?.notify_whatsapp !== undefined || data?.is_public !== undefined) {
            const { error: vErr } = await this.supabase
                .from("live_visibility_rules")
                .upsert({
                live_session_id: session.id,
                tenant_id: tenantId,
                is_public: data?.is_public === true,
                notify_dashboard: data?.notify_dashboard !== false,
                notify_email: data?.notify_email === true,
                notify_whatsapp: data?.notify_whatsapp === true,
            }, { onConflict: "live_session_id" });
            if (vErr)
                this.logger.warn(`visibility_rules: ${vErr.message}`);
        }
        return session;
    }
    async findAll(tenantId) {
        const { data } = await this.supabase
            .from("live_sessions")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("scheduled_at", { ascending: true });
        return data ?? [];
    }
    async findOne(tenantId, sessionId) {
        const { data, error } = await this.supabase
            .from("live_sessions")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("id", sessionId)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException("Session introuvable");
        return data;
    }
    async startSession(tenantId, sessionId) {
        const session = await this.findOne(tenantId, sessionId);
        if (session.status === "live")
            return session;
        if (session.status === "ended") {
            throw new common_1.BadRequestException("La session est déjà terminée");
        }
        const { limits } = await this.entitlements.resolveLimits(tenantId);
        if (limits.maxConcurrentLives !== null) {
            const { count } = await this.supabase
                .from("live_sessions")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", tenantId)
                .eq("status", "live")
                .neq("id", sessionId);
            if ((count ?? 0) >= limits.maxConcurrentLives) {
                throw new common_1.ForbiddenException(`Forfait gratuit : ${limits.maxConcurrentLives} live à la fois. Terminez votre live en cours, ou passez à un forfait LIRI pour des lives simultanés.`);
            }
        }
        await this.usage.assertCanStartLive(tenantId);
        const { data } = await this.supabase
            .from("live_sessions")
            .update({ status: "live", started_at: new Date().toISOString() })
            .eq("id", sessionId)
            .eq("tenant_id", tenantId)
            .select("*")
            .single();
        return data;
    }
    async endSession(tenantId, sessionId) {
        try {
            await this.stopRecording(tenantId, sessionId);
        }
        catch {
        }
        const { data } = await this.supabase
            .from("live_sessions")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", sessionId)
            .eq("tenant_id", tenantId)
            .select("*")
            .single();
        if (!data)
            throw new common_1.NotFoundException("Session introuvable");
        const waitingClose = await this.supabase
            .from('live_waiting_room_entries')
            .update({ status: 'rejected' })
            .eq('live_session_id', sessionId)
            .eq('status', 'waiting');
        if (waitingClose.error) {
            this.logger.warn(`Fin live ${sessionId}: salle d'attente non vidée (${waitingClose.error.message})`);
        }
        const admittedClose = await this.supabase
            .from('live_waiting_room_entries')
            .update({ status: 'left' })
            .eq('live_session_id', sessionId)
            .eq('status', 'admitted');
        if (admittedClose.error) {
            this.logger.warn(`Fin live ${sessionId}: participants non clôturés (${admittedClose.error.message})`);
        }
        return data;
    }
    async startRecording(tenantId, sessionId) {
        const { limits } = await this.entitlements.resolveLimits(tenantId);
        if (!limits.canReplay) {
            throw new common_1.ForbiddenException("Forfait gratuit : l'enregistrement et le replay ne sont pas inclus. Passez à un forfait LIRI pour enregistrer et rediffuser vos lives.");
        }
        return this._startEgressForSession(tenantId, sessionId);
    }
    async startRecordingForTeleconsult(tenantId, sessionId) {
        return this._startEgressForSession(tenantId, sessionId);
    }
    async _startEgressForSession(tenantId, sessionId) {
        const session = await this.findOne(tenantId, sessionId);
        const { data: tnt } = await this.supabase
            .from("tenants")
            .select("slug")
            .eq("id", tenantId)
            .maybeSingle();
        const slug = tnt?.slug ?? session.tenant_slug ?? sessionId;
        const roomName = livekit_service_1.LiveKitService.scopedRoomName(slug, sessionId);
        const { egressId, filepath } = await this.liveKit.startRecording(roomName, sessionId, slug);
        const { data } = await this.supabase
            .from("live_recordings")
            .insert({
            live_session_id: sessionId,
            egress_id: egressId,
            status: egressId ? "recording" : "failed",
            started_at: new Date().toISOString(),
            tenant_slug: slug,
            storage_filepath: filepath,
        })
            .select("*")
            .single();
        if (egressId) {
            await this.supabase
                .from("live_sessions")
                .update({ replay_enabled: true })
                .eq("id", sessionId)
                .eq("tenant_id", tenantId);
        }
        return { recording: data, egressId, recording_active: Boolean(egressId) };
    }
    async stopRecording(tenantId, sessionId) {
        await this.findOne(tenantId, sessionId);
        const { data: rec } = await this.supabase
            .from("live_recordings")
            .select("*")
            .eq("live_session_id", sessionId)
            .eq("status", "recording")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (rec?.egress_id)
            await this.liveKit.stopRecording(rec.egress_id);
        if (rec?.id) {
            await this.supabase
                .from("live_recordings")
                .update({ status: "stopped", completed_at: new Date().toISOString() })
                .eq("id", rec.id);
        }
        return { stopped: Boolean(rec), recordingId: rec?.id ?? null, recording_active: false };
    }
    async replayPublishStatus(tenantId) {
        const { data } = await this.supabase
            .from("tenants")
            .select("metadata")
            .eq("id", tenantId)
            .maybeSingle();
        const mode = data?.metadata?.replay?.publish_mode;
        return mode === "auto" ? "published" : "pending_review";
    }
    async isSessionEditor(tenantId, sessionId, actorId) {
        const { data: s } = await this.supabase
            .from("live_sessions")
            .select("host_user_id, teacher_id")
            .eq("id", sessionId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        if (s && (s.host_user_id === actorId || s.teacher_id === actorId)) {
            return true;
        }
        const { data: m } = await this.supabase
            .from("tenant_memberships")
            .select("role")
            .eq("tenant_id", tenantId)
            .eq("user_id", actorId)
            .maybeSingle();
        return ["owner", "admin", "teacher"].includes(String(m?.role || ""));
    }
    async publishReplay(tenantId, sessionId, opts) {
        const { data: kindRow } = await this.supabase
            .from("live_sessions")
            .select("kind")
            .eq("id", sessionId)
            .maybeSingle();
        if (kindRow?.kind === "teleconsult") {
            return { published: false, reason: "teleconsult" };
        }
        if (opts?.actorId &&
            !(await this.isSessionEditor(tenantId, sessionId, opts.actorId))) {
            throw new common_1.ForbiddenException("Réservé à l'hôte ou à un encadrant");
        }
        const { data: rec } = await this.supabase
            .from("live_recordings")
            .select("storage_filepath")
            .eq("live_session_id", sessionId)
            .eq("status", "completed")
            .not("storage_filepath", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!rec?.storage_filepath) {
            return { published: false, reason: "no_recording" };
        }
        const playbackUrl = `${process.env.PUBLIC_API_URL ?? "https://api.cimolace.space"}/lives/${sessionId}/replay/file`;
        const status = opts?.force ?? (await this.replayPublishStatus(tenantId));
        const { data } = await this.supabase
            .from("live_neuro_recall_state")
            .upsert({
            live_session_id: sessionId,
            replay_public_url: playbackUrl,
            workflow_status: status,
            updated_at: new Date().toISOString(),
        }, { onConflict: "live_session_id" })
            .select("*")
            .single();
        let forumPosted = false;
        if (status === "published") {
            forumPosted = await this.postReplayToForum(tenantId, sessionId, playbackUrl);
        }
        return {
            published: status === "published",
            workflow_status: status,
            forumPosted,
            state: data,
        };
    }
    async canViewReplay(tenantId, sessionId, userId) {
        if (await this.isSessionEditor(tenantId, sessionId, userId))
            return true;
        const { data: p } = await this.supabase
            .from("live_session_participants")
            .select("user_id")
            .eq("live_session_id", sessionId)
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
        if (p)
            return true;
        const { data: sess } = await this.supabase
            .from("live_sessions")
            .select("formation_id")
            .eq("id", sessionId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        const formationId = sess?.formation_id;
        if (formationId) {
            const { data: e } = await this.supabase
                .from("student_progress")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("user_id", userId)
                .eq("course_id", formationId)
                .limit(1)
                .maybeSingle();
            if (e)
                return true;
        }
        return false;
    }
    async resolveReplayPlaybackUrl(sessionId, userId) {
        const { data: sess } = await this.supabase
            .from("live_sessions")
            .select("tenant_id")
            .eq("id", sessionId)
            .maybeSingle();
        const tenantId = sess?.tenant_id;
        if (!tenantId)
            throw new common_1.NotFoundException("Session introuvable");
        if (!(await this.canViewReplay(tenantId, sessionId, userId))) {
            throw new common_1.ForbiddenException("Accès au replay refusé");
        }
        const { data: rec } = await this.supabase
            .from("live_recordings")
            .select("storage_filepath")
            .eq("live_session_id", sessionId)
            .eq("status", "completed")
            .not("storage_filepath", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        const filepath = rec?.storage_filepath;
        if (!filepath)
            throw new common_1.NotFoundException("Aucun enregistrement disponible");
        const url = await this.liveKit.presignReplayGet(filepath, 3600);
        if (!url)
            throw new common_1.ServiceUnavailableException("Stockage replay indisponible");
        return url;
    }
    async getTeleconsultRecordingState(sessionId) {
        const { data: rows } = await this.supabase
            .from("live_recordings")
            .select("status, started_at, completed_at, duration_seconds, storage_filepath")
            .eq("live_session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(10);
        const list = (rows || []).filter(Boolean);
        const active = list.find((r) => r.status === "recording");
        const done = list.find((r) => r.status === "completed" && r.storage_filepath);
        return {
            recording: Boolean(active),
            hasReplay: Boolean(done),
            startedAt: active?.started_at ?? done?.started_at ?? null,
            completedAt: done?.completed_at ?? null,
            durationSeconds: done?.duration_seconds ?? null,
        };
    }
    async resolveTeleconsultReplayUrl(sessionId) {
        const { data: rec } = await this.supabase
            .from("live_recordings")
            .select("storage_filepath")
            .eq("live_session_id", sessionId)
            .eq("status", "completed")
            .not("storage_filepath", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        const filepath = rec?.storage_filepath;
        if (!filepath)
            return null;
        return this.liveKit.presignReplayGet(filepath, 3600);
    }
    async unpublishReplay(tenantId, sessionId, actorId) {
        if (actorId && !(await this.isSessionEditor(tenantId, sessionId, actorId))) {
            throw new common_1.ForbiddenException("Réservé à l'hôte ou à un encadrant");
        }
        const { data } = await this.supabase
            .from("live_neuro_recall_state")
            .update({
            workflow_status: "pending_review",
            updated_at: new Date().toISOString(),
        })
            .eq("live_session_id", sessionId)
            .select("*")
            .maybeSingle();
        await this.removeReplayFromForum(tenantId, sessionId);
        return { unpublished: Boolean(data), state: data };
    }
    async postReplayToForum(tenantId, sessionId, replayUrl) {
        const { data: s } = await this.supabase
            .from("live_sessions")
            .select("host_user_id, title")
            .eq("id", sessionId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        if (!s)
            return false;
        const hostId = s.host_user_id;
        const title = s.title || "Live";
        const topicId = await this.resolveLiveTopicId(tenantId, sessionId, hostId, title);
        if (!topicId)
            return false;
        const { data: dup } = await this.supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", topicId)
            .ilike("content", `${LiveService_1.REPLAY_MARK}%`)
            .limit(1)
            .maybeSingle();
        if (dup)
            return true;
        const content = `${LiveService_1.REPLAY_MARK} — ${title}\n${replayUrl}`;
        const { error } = await this.supabase.from("messages").insert({
            tenant_id: tenantId,
            conversation_id: topicId,
            sender_id: hostId,
            recipient_id: null,
            content,
        });
        if (error)
            return false;
        await this.supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", topicId);
        return true;
    }
    async removeReplayFromForum(tenantId, sessionId) {
        const topicId = await this.resolveLiveTopicId(tenantId, sessionId);
        if (!topicId)
            return;
        await this.supabase
            .from("messages")
            .delete()
            .eq("conversation_id", topicId)
            .ilike("content", `${LiveService_1.REPLAY_MARK}%`);
    }
    async resolveLiveTopicId(tenantId, sessionId, hostId, title) {
        const found = await this.supabase
            .from("conversations")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("kind", "topic")
            .eq("context_type", "live")
            .eq("context_id", sessionId)
            .maybeSingle();
        if (found.data?.id)
            return found.data.id;
        if (!hostId)
            return null;
        const subject = `Sujet du live — ${title || "Live"}`;
        const ins = await this.supabase
            .from("conversations")
            .insert({
            tenant_id: tenantId,
            kind: "topic",
            type: "group",
            name: subject,
            subject,
            status: "open",
            visibility: "context",
            context_type: "live",
            context_id: sessionId,
            created_by: hostId,
        })
            .select("id")
            .maybeSingle();
        if (ins.data?.id)
            return ins.data.id;
        const re = await this.supabase
            .from("conversations")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("kind", "topic")
            .eq("context_type", "live")
            .eq("context_id", sessionId)
            .maybeSingle();
        return re.data?.id ?? null;
    }
    async resolveMemberCycle(tenantId, userId) {
        if (!tenantId || !userId)
            return null;
        const { data: subs } = await this.supabase
            .from("billing_subscriptions")
            .select("plan_id, status, current_period_end")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .eq("status", "active");
        let best = null;
        for (const s of subs ?? []) {
            const endStr = s.current_period_end;
            const end = endStr ? new Date(endStr).getTime() : null;
            if (end !== null && end < Date.now())
                continue;
            const c = (0, member_tier_1.cycleFromPlanId)(s.plan_id);
            if (c && (0, member_tier_1.rankOfCycle)(c) > (0, member_tier_1.rankOfCycle)(best))
                best = c;
        }
        return best;
    }
    async generateToken(sessionId, userId, requestedRole, tenant) {
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("host_user_id, tenant_id, status, started_at, price_cents, formation_id, tenants(slug)")
            .eq("id", sessionId)
            .single();
        if (!session)
            throw new common_1.NotFoundException("Session introuvable");
        const STAFF = new Set(["owner", "admin", "teacher", "secretariat", "practitioner"]);
        const isHost = session.host_user_id === userId ||
            STAFF.has(String(tenant?.userRole ?? "").toLowerCase());
        const role = isHost ? "host" : "student";
        if (role !== "host") {
            const { data: wr } = await this.supabase
                .from("live_waiting_room_entries")
                .select("status")
                .eq("live_session_id", sessionId)
                .eq("user_id", userId)
                .maybeSingle();
            if (wr?.status === "rejected") {
                throw new common_1.ForbiddenException("Accès refusé par l'hôte de cette session.");
            }
        }
        if (role !== "host" && Number(session.price_cents ?? 0) > 0) {
            const { data: pass } = await this.supabase
                .from("access_passes")
                .select("id")
                .eq("tenant_id", session.tenant_id)
                .eq("user_id", userId)
                .eq("resource_type", "live_session")
                .eq("resource_id", sessionId)
                .eq("status", "active")
                .maybeSingle();
            if (!pass?.id) {
                throw new common_1.ForbiddenException("Ce live est payant : complétez votre paiement pour y accéder.");
            }
        }
        if (role !== "host" && session.formation_id) {
            const cycle = await this.resolveMemberCycle(session.tenant_id, userId);
            if (!(0, member_tier_1.cycleCan)(cycle, "liveCursus")) {
                throw new common_1.ForbiddenException("Ce live fait partie d'un cursus : un forfait Académique ou supérieur est requis pour y accéder.");
            }
        }
        const slug = tenant?.slug ?? session?.tenants?.slug ?? sessionId;
        const roomName = livekit_service_1.LiveKitService.scopedRoomName(slug, sessionId);
        const { limits } = await this.entitlements.resolveLimits(session.tenant_id);
        let cappedTtlSeconds;
        if (limits.maxLiveMinutes !== null) {
            const startedAt = session.started_at
                ? new Date(session.started_at).getTime()
                : null;
            const isLive = session.status === "live" && startedAt !== null;
            if (isLive) {
                const deadline = startedAt + limits.maxLiveMinutes * 60_000;
                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) {
                    throw new common_1.ForbiddenException(`Forfait gratuit : ce live a atteint sa limite de ${limits.maxLiveMinutes} minutes. Passez à un forfait LIRI pour des lives illimités.`);
                }
                cappedTtlSeconds = Math.max(30, Math.floor(remainingMs / 1000));
            }
            else {
                cappedTtlSeconds = limits.maxLiveMinutes * 60;
            }
        }
        if (limits.maxParticipants !== null && role !== "host") {
            const present = await this.liveKit.listParticipantIdentities(roomName);
            const alreadyIn = present.includes(userId);
            if (!alreadyIn && present.length >= limits.maxParticipants) {
                throw new common_1.ForbiddenException(`Forfait gratuit : ${limits.maxParticipants} participants maximum dans un live. Passez à un forfait LIRI pour accueillir plus de monde.`);
            }
        }
        await this.liveKit.ensureRoom(roomName, sessionId, userId);
        const token = role === "host"
            ? await this.liveKit.generateHostToken(roomName, userId, undefined, cappedTtlSeconds ?? "4h")
            : await this.liveKit.generateParticipantToken(roomName, userId, undefined, cappedTtlSeconds ?? "1h");
        return { token, room: roomName, role, userId, requestedRole: requestedRole ?? null };
    }
    async createPublicGuestPass(tenantId, sessionId, userId) {
        const db = this.supabase;
        const { data: session } = await db
            .from("live_sessions").select("id, tenant_id").eq("id", sessionId).maybeSingle();
        if (!session || session.tenant_id !== tenantId) {
            throw new common_1.NotFoundException("Session introuvable");
        }
        const { data: existing } = await db
            .from("access_passes")
            .select("id")
            .eq("resource_type", "live_session")
            .eq("resource_id", sessionId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
        if (existing?.id)
            return { passId: existing.id };
        const { data: created, error } = await db
            .from("access_passes")
            .insert({ user_id: userId, tenant_id: tenantId, resource_type: "live_session", resource_id: sessionId, status: "active" })
            .select("id")
            .maybeSingle();
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { passId: created?.id ?? null };
    }
    async resolveGuestInvite(sessionId, inviteId) {
        const { data: pass } = await this.supabase
            .from("access_passes")
            .select("id, user_id, tenant_id, resource_type, resource_id, status")
            .eq("id", inviteId)
            .maybeSingle();
        if (pass &&
            pass.resource_type === "live_session" &&
            pass.resource_id === sessionId &&
            pass.status === "active") {
            return { tenantId: pass.tenant_id, userId: pass.user_id ?? null, source: "pass" };
        }
        const { data: inv } = await this.supabase
            .from("live_session_invites")
            .select("id, tenant_id, session_id, status, created_by")
            .eq("id", inviteId)
            .maybeSingle();
        if (inv && inv.session_id === sessionId && inv.status !== "revoked") {
            return { tenantId: inv.tenant_id, userId: inv.created_by ?? null, source: "invite" };
        }
        throw new common_1.ForbiddenException("Lien d'accès invalide ou expiré.");
    }
    async generateGuestLiveToken(sessionId, inviteId, tenantSlug) {
        const invite = await this.resolveGuestInvite(sessionId, inviteId);
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("tenant_id, status, started_at, tenants(slug)")
            .eq("id", sessionId)
            .single();
        if (!session)
            throw new common_1.NotFoundException("Session introuvable");
        if (session.tenant_id !== invite.tenantId) {
            throw new common_1.ForbiddenException("Accès refusé.");
        }
        const slug = tenantSlug ?? session?.tenants?.slug ?? sessionId;
        const roomName = livekit_service_1.LiveKitService.scopedRoomName(slug, sessionId);
        const identity = `guest_${inviteId}`;
        const { limits } = await this.entitlements.resolveLimits(session.tenant_id);
        let cappedTtlSeconds;
        if (limits.maxLiveMinutes !== null) {
            const startedAt = session.started_at
                ? new Date(session.started_at).getTime()
                : null;
            const isLive = session.status === "live" && startedAt !== null;
            if (isLive) {
                const remainingMs = startedAt + limits.maxLiveMinutes * 60_000 - Date.now();
                if (remainingMs <= 0) {
                    throw new common_1.ForbiddenException(`Forfait gratuit : ce live a atteint sa limite de ${limits.maxLiveMinutes} minutes.`);
                }
                cappedTtlSeconds = Math.max(30, Math.floor(remainingMs / 1000));
            }
            else {
                cappedTtlSeconds = limits.maxLiveMinutes * 60;
            }
        }
        if (limits.maxParticipants !== null) {
            const present = await this.liveKit.listParticipantIdentities(roomName);
            if (!present.includes(identity) && present.length >= limits.maxParticipants) {
                throw new common_1.ForbiddenException(`Forfait gratuit : ${limits.maxParticipants} participants maximum dans un live.`);
            }
        }
        await this.liveKit.ensureRoom(roomName, sessionId, (invite.userId ?? undefined));
        const token = await this.liveKit.generateParticipantToken(roomName, identity, undefined, cappedTtlSeconds ?? "1h");
        return { token, room: roomName, role: "guest", identity };
    }
    async getPublicGuestInfo(sessionId, inviteId, tenantSlug) {
        const invite = await this.resolveGuestInvite(sessionId, inviteId);
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("id, tenant_id, title, description, session_type, status, scheduled_at, started_at, cover_image_url, host_user_id, tenants(slug, name)")
            .eq("id", sessionId)
            .single();
        if (!session)
            throw new common_1.NotFoundException("Session introuvable");
        if (session.tenant_id !== invite.tenantId) {
            throw new common_1.ForbiddenException("Accès refusé.");
        }
        let hostName = null;
        if (session.host_user_id) {
            try {
                const { data: prof } = await this.supabase
                    .from("profiles")
                    .select("display_name, full_name")
                    .eq("id", session.host_user_id)
                    .maybeSingle();
                hostName =
                    prof?.display_name || prof?.full_name || null;
            }
            catch {
                hostName = null;
            }
        }
        return {
            id: session.id,
            title: session.title ?? null,
            description: session.description ?? null,
            session_type: session.session_type ?? null,
            status: session.status ?? null,
            scheduled_at: session.scheduled_at ?? null,
            started_at: session.started_at ?? null,
            cover_image_url: session.cover_image_url ?? null,
            host_name: hostName,
            tenant: {
                slug: tenantSlug ?? session?.tenants?.slug ?? null,
                name: session?.tenants?.name ?? null,
            },
        };
    }
    async createLiveSessionInvite(tenantId, hostId, sessionId, dto) {
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("id, tenant_id, title, session_type, tenants(slug, name)")
            .eq("id", sessionId)
            .single();
        if (!session || session.tenant_id !== tenantId) {
            throw new common_1.NotFoundException("Session introuvable");
        }
        const isMember = dto.kind === "member" || !!dto.invited_user_id;
        let displayName = String(dto.display_name || "").trim();
        let email = String(dto.email || "").trim().toLowerCase();
        if (isMember && dto.invited_user_id) {
            try {
                const { data: u } = await this.supabase.auth.admin.getUserById(dto.invited_user_id);
                const meta = u?.user?.user_metadata || {};
                if (!displayName)
                    displayName = String(meta.full_name || meta.name || u?.user?.email || "Membre");
                if (!email)
                    email = String(u?.user?.email || "").toLowerCase();
            }
            catch {
            }
        }
        if (!displayName)
            displayName = isMember ? "Membre" : "Invité";
        const { data, error } = await this.supabase
            .from("live_session_invites")
            .insert({
            tenant_id: tenantId,
            session_id: sessionId,
            display_name: displayName,
            relationship: String(dto.relationship || "").trim() || null,
            invited_email: email || null,
            invited_user_id: isMember ? dto.invited_user_id || null : null,
            kind: isMember ? "member" : "guest",
            status: isMember ? "admitted" : "invited",
            created_by: hostId,
        })
            .select("*")
            .single();
        if (error || !data) {
            throw new common_1.BadRequestException(error?.message || "Création de l'invitation impossible");
        }
        const emailStatus = await this.sendLiveInviteEmail(tenantId, data, session);
        try {
            await this.supabase
                .from("live_session_invites")
                .update({ email_status: emailStatus })
                .eq("id", data.id);
        }
        catch {
        }
        return { ...data, email_status: emailStatus };
    }
    async listLiveSessionInvites(tenantId, sessionId) {
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("id, tenant_id")
            .eq("id", sessionId)
            .single();
        if (!session || session.tenant_id !== tenantId) {
            throw new common_1.NotFoundException("Session introuvable");
        }
        const { data } = await this.supabase
            .from("live_session_invites")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        return Array.isArray(data) ? data : [];
    }
    async updateLiveInviteStatus(tenantId, sessionId, inviteId, status) {
        const { data: row } = await this.supabase
            .from("live_session_invites")
            .select("id, tenant_id, session_id")
            .eq("id", inviteId)
            .maybeSingle();
        if (!row || row.tenant_id !== tenantId || row.session_id !== sessionId) {
            throw new common_1.NotFoundException("Invitation introuvable");
        }
        const { data, error } = await this.supabase
            .from("live_session_invites")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", inviteId)
            .select("*")
            .single();
        if (error)
            throw new common_1.BadRequestException(error.message);
        return data;
    }
    async admitLiveSessionInvite(tenantId, sessionId, inviteId) {
        return this.updateLiveInviteStatus(tenantId, sessionId, inviteId, "admitted");
    }
    async revokeLiveSessionInvite(tenantId, sessionId, inviteId) {
        return this.updateLiveInviteStatus(tenantId, sessionId, inviteId, "revoked");
    }
    async sendLiveInviteEmail(tenantId, invite, session) {
        const to = String(invite?.invited_email || "").trim();
        if (!to)
            return "skipped";
        try {
            const { data: ns } = await this.supabase
                .from("tenant_notification_settings")
                .select("email_from, email_from_name")
                .eq("tenant_id", tenantId)
                .maybeSingle();
            const slug = session?.tenants?.slug || "";
            const orgName = session?.tenants?.name || "l'organisateur";
            const base = process.env.SCHOOL_FRONTEND_URL || process.env.APP_URL || "https://prorascience.org";
            const link = `${base}/live/${invite.session_id}/invite/${invite.id}${slug ? `?tenant=${encodeURIComponent(slug)}` : ""}`;
            const title = session?.title || "un direct";
            await this.supabase.from("email_queue").insert({
                tenant_id: tenantId,
                to,
                from: ns?.email_from ?? null,
                from_name: ns?.email_from_name ?? null,
                subject: `Invitation — ${title}`,
                html_body: `<h2>Vous êtes invité·e</h2>` +
                    `<p>${String(invite.display_name || "Bonjour")}, ${orgName} vous invite à rejoindre « ${title} ».</p>` +
                    `<p><a href="${link}" style="display:inline-block;background:#d97757;color:#000;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;">Rejoindre</a></p>` +
                    `<p style="color:#888;font-size:12px;">Aucun compte requis. Si vous n'êtes pas concerné·e, ignorez cet email.</p>`,
                status: "pending",
            });
            return "sent";
        }
        catch {
            return "failed";
        }
    }
    async maybeStartRecording(tenantId, sessionId) {
        if (!process.env.CF_R2_BUCKET)
            return;
        try {
            const { data: existing } = await this.supabase
                .from("live_recordings")
                .select("id")
                .eq("live_session_id", sessionId)
                .in("status", ["recording", "completed", "stopped"])
                .limit(1)
                .maybeSingle();
            if (existing)
                return;
            await this.startRecording(tenantId, sessionId);
        }
        catch {
        }
    }
    roomNameFor(tenantSlug, externalRef) {
        return livekit_service_1.LiveKitService.scopedRoomName(tenantSlug, externalRef);
    }
    listRoomParticipants(tenantSlug, externalRef) {
        return this.liveKit.listParticipantIdentities(this.roomNameFor(tenantSlug, externalRef));
    }
    async closeRoom(tenantSlug, externalRef) {
        await this.liveKit.deleteRoom(this.roomNameFor(tenantSlug, externalRef));
    }
    muteParticipant(tenantSlug, externalRef, identity) {
        return this.liveKit.muteParticipantAudio(this.roomNameFor(tenantSlug, externalRef), identity);
    }
    removeParticipant(tenantSlug, externalRef, identity) {
        return this.liveKit.removeParticipant(this.roomNameFor(tenantSlug, externalRef), identity);
    }
    async issueTokenForSession(input) {
        const roomName = livekit_service_1.LiveKitService.scopedRoomName(input.tenantSlug, input.externalRef);
        await this.liveKit.ensureRoom(roomName, input.externalRef, input.userId);
        const token = input.role === "host"
            ? await this.liveKit.generateHostToken(roomName, input.userId, input.displayName)
            : input.guestCanPublish
                ? await this.liveKit.generatePeerToken(roomName, input.userId, input.displayName)
                : await this.liveKit.generateParticipantToken(roomName, input.userId, input.displayName);
        const sessionId = await this.recordLiriSession({
            tenantId: input.tenantId,
            purpose: input.purpose,
            externalRef: input.externalRef,
            roomName,
            hostUserId: input.userId,
            metadata: input.metadata,
        });
        return {
            sessionId,
            room: roomName,
            token,
            url: this.liveKit.getUrl(),
            ttl: input.role === "host" ? "4h" : input.guestCanPublish ? "2h" : "1h",
            purpose: input.purpose,
        };
    }
    async recordLiriSession(input) {
        const supabase = this.supabase;
        await supabase
            .from("liri_sessions")
            .upsert({
            tenant_id: input.tenantId,
            purpose: input.purpose,
            external_ref: input.externalRef,
            room_name: input.roomName,
            host_user_id: input.hostUserId,
            metadata: (input.metadata ?? {}),
        }, { onConflict: "tenant_id,external_ref", ignoreDuplicates: true });
        const { data } = await supabase
            .from("liri_sessions")
            .select("id")
            .eq("tenant_id", input.tenantId)
            .eq("external_ref", input.externalRef)
            .single();
        return data?.id ?? "";
    }
    async endLiriSession(tenantId, externalRef) {
        const supabase = this.supabase;
        const { data: existing } = await supabase
            .from("liri_sessions")
            .select("id, started_at, ended_at")
            .eq("tenant_id", tenantId)
            .eq("external_ref", externalRef)
            .single();
        if (!existing)
            return null;
        const row = existing;
        if (row.ended_at) {
            return {
                duration_seconds: 0,
                ended_at: row.ended_at,
            };
        }
        const endedAt = new Date();
        const durationSec = Math.max(0, Math.floor((endedAt.getTime() - new Date(row.started_at).getTime()) / 1000));
        await supabase
            .from("liri_sessions")
            .update({
            ended_at: endedAt.toISOString(),
            duration_seconds: durationSec,
        })
            .eq("id", row.id);
        return {
            duration_seconds: durationSec,
            ended_at: endedAt.toISOString(),
        };
    }
    async endLiriSessionByRoomName(roomName) {
        const supabase = this.supabase;
        const { data } = await supabase
            .from('liri_sessions')
            .select('id, tenant_id, external_ref, started_at, ended_at')
            .eq('room_name', roomName)
            .single();
        if (!data)
            return null;
        const row = data;
        if (row.ended_at) {
            return { session_id: row.id, duration_seconds: 0, tenant_id: row.tenant_id ?? null };
        }
        const endedAt = new Date();
        const durationSec = Math.max(0, Math.floor((endedAt.getTime() - new Date(row.started_at).getTime()) / 1000));
        await supabase
            .from('liri_sessions')
            .update({
            ended_at: endedAt.toISOString(),
            duration_seconds: durationSec,
        })
            .eq('id', row.id);
        return { session_id: row.id, duration_seconds: durationSec, tenant_id: row.tenant_id ?? null };
    }
    async getLiriConsumption(tenantId, from, to) {
        const supabase = this.supabase;
        const { data } = await supabase
            .from("liri_sessions")
            .select("purpose, duration_seconds")
            .eq("tenant_id", tenantId)
            .gte("started_at", from)
            .lte("started_at", to)
            .not("ended_at", "is", null);
        const buckets = {};
        for (const row of data ?? []) {
            const r = row;
            const key = r.purpose;
            if (!buckets[key])
                buckets[key] = { count: 0, seconds: 0 };
            buckets[key].count += 1;
            buckets[key].seconds += r.duration_seconds ?? 0;
        }
        return Object.entries(buckets).map(([purpose, b]) => ({
            purpose,
            session_count: b.count,
            total_seconds: b.seconds,
            total_minutes: Math.round(b.seconds / 60),
        }));
    }
};
exports.LiveService = LiveService;
LiveService.REPLAY_MARK = "📹 Replay du live";
exports.LiveService = LiveService = LiveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        livekit_service_1.LiveKitService,
        liri_entitlements_service_1.LiriEntitlementsService,
        usage_service_1.UsageService])
], LiveService);
//# sourceMappingURL=live.service.js.map