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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let BillingService = class BillingService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async getSubscription(tenantId) {
        const { data } = await this.supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).single();
        return data;
    }
    async createSubscription(tenantId, plan, provider) {
        const { data } = await this.supabase.from("subscriptions").insert({ tenant_id: tenantId, plan, provider, status: "active" }).select().single();
        return data;
    }
    async getInvoices(tenantId) {
        const { data } = await this.supabase.from("invoices").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async handleWebhook(payload, signature) {
        console.log("Webhook received", { sig: signature?.slice(0, 10), len: payload.length });
        return { received: true };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], BillingService);
//# sourceMappingURL=billing.service.js.map