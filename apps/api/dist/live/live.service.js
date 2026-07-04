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
let LiveService = LiveService_1 = class LiveService {
    constructor(auth, liveKit, entitlements) {
        this.auth = auth;
        this.liveKit = liveKit;
        this.entitlements = entitlements;
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
        const { data: session } = await this.supabase
            .from("live_sessions")
            .insert({ tenant_id: tenantId, ...data, status: "scheduled" })
            .select()
            .single();
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
        return data;
    }
    async startRecording(tenantId, sessionId) {
        const session = await this.findOne(tenantId, sessionId);
        const { limits } = await this.entitlements.resolveLimits(tenantId);
        if (!limits.canReplay) {
            throw new common_1.ForbiddenException("Forfait gratuit : l'enregistrement et le replay ne sont pas inclus. Passez à un forfait LIRI pour enregistrer et rediffuser vos lives.");
        }
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
    async generateToken(sessionId, userId, requestedRole, tenant) {
        const { data: session } = await this.supabase
            .from("live_sessions")
            .select("host_user_id, tenant_id, status, started_at, price_cents, tenants(slug)")
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
            return { session_id: row.id, duration_seconds: 0 };
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
        return { session_id: row.id, duration_seconds: durationSec };
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
        liri_entitlements_service_1.LiriEntitlementsService])
], LiveService);
//# sourceMappingURL=live.service.js.map