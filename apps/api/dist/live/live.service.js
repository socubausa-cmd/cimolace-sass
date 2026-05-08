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
let LiveService = class LiveService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async createSession(tenantId, data) {
        const { data: session } = await this.supabase.from("live_sessions").insert({ tenant_id: tenantId, ...data, status: "scheduled" }).select().single();
        return session;
    }
    async findAll(tenantId) {
        const { data } = await this.supabase.from("live_sessions").select("*").eq("tenant_id", tenantId).order("scheduled_at", { ascending: true });
        return data ?? [];
    }
    async generateToken(sessionId, userId, role) {
        return { token: "livekit_jwt_placeholder", room: sessionId, role, userId };
    }
};
exports.LiveService = LiveService;
exports.LiveService = LiveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], LiveService);
//# sourceMappingURL=live.service.js.map