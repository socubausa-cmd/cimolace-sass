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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let NotificationsService = class NotificationsService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async getUserNotifications(tenantId, userId) {
        const { data } = await this.supabase.from("notifications").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
        return data ?? [];
    }
    async markRead(tenantId, notifId) {
        const { data } = await this.supabase.from("notifications").update({ read: true }).eq("tenant_id", tenantId).eq("id", notifId).select().single();
        return data;
    }
    async send(tenantId, userId, payload) {
        const { data } = await this.supabase.from("notifications").insert({ tenant_id: tenantId, user_id: userId, ...payload, read: false }).select().single();
        return data;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map