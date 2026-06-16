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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const email_engine_service_1 = require("../email-engine/email-engine.service");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(auth, email) {
        this.auth = auth;
        this.email = email;
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    get supabase() { return this.auth.getClient(); }
    async getUserNotifications(tenantId, userId) {
        const { data } = await this.supabase
            .from("notifications")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50);
        return (data ?? []).map((n) => ({ ...n, read: n.is_read ?? false }));
    }
    async markRead(tenantId, notifId) {
        const { data, error } = await this.supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("tenant_id", tenantId)
            .eq("id", notifId)
            .select()
            .single();
        if (error)
            return { id: notifId };
        return { ...data, read: true };
    }
    async send(tenantId, userId, payload) {
        const insert = (type) => this.supabase
            .from("notifications")
            .insert({ tenant_id: tenantId, user_id: userId, type, title: payload.title, body: payload.body, is_read: false })
            .select()
            .single();
        let { data, error } = await insert(payload.type);
        if (error && /check constraint|notifications_type_check/i.test(error.message)) {
            ({ data, error } = await insert("info"));
        }
        if (error)
            throw new Error(error.message);
        if (payload.email) {
            this.emailUser(tenantId, userId, payload).catch((e) => this.logger.warn(`notif email: ${e.message}`));
        }
        return { ...data, read: false, type: data?.type ?? payload.type };
    }
    async emailUser(tenantId, userId, payload) {
        const { data } = await this.supabase.auth.admin.getUserById(userId);
        const to = data?.user?.email;
        if (!to)
            return;
        const html = this.email.brandedHtml({
            title: payload.title,
            body: payload.body,
            ctaUrl: payload.actionUrl,
            ctaLabel: payload.actionUrl ? "Ouvrir mon espace" : undefined,
        });
        await this.email.sendRaw(tenantId, to, payload.title, html);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService, email_engine_service_1.EmailEngineService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map