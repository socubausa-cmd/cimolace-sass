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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const livekit_service_1 = require("../livekit/livekit.service");
let LiveService = class LiveService {
    constructor(auth, liveKit) {
        this.auth = auth;
        this.liveKit = liveKit;
    }
    get supabase() { return this.auth.getClient(); }
    async createSession(tenantId, data) {
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
    async generateToken(sessionId, userId, role, tenantSlug) {
        let slug = tenantSlug ?? "";
        if (!slug) {
            const { data: session } = await this.supabase
                .from("live_sessions")
                .select("tenant_id, tenants(slug)")
                .eq("id", sessionId)
                .single();
            slug = session?.tenants?.slug ?? sessionId;
        }
        const roomName = livekit_service_1.LiveKitService.scopedRoomName(slug, sessionId);
        await this.liveKit.ensureRoom(roomName, sessionId, userId);
        const token = role === "host"
            ? await this.liveKit.generateHostToken(roomName, userId)
            : await this.liveKit.generateParticipantToken(roomName, userId);
        return { token, room: roomName, role, userId };
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
exports.LiveService = LiveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        livekit_service_1.LiveKitService])
], LiveService);
//# sourceMappingURL=live.service.js.map