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
exports.MarketingService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let MarketingService = class MarketingService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async getPromos(tenantId) {
        const { data } = await this.supabase.from("promo_codes").select("*").eq("tenant_id", tenantId);
        return data ?? [];
    }
    async createPromo(tenantId, dto) {
        const { data } = await this.supabase.from("promo_codes").insert({ tenant_id: tenantId, ...dto }).select().single();
        return data;
    }
    async getPopups(tenantId) {
        const { data } = await this.supabase.from("popups").select("*").eq("tenant_id", tenantId);
        return data ?? [];
    }
    async getBanners(tenantId) {
        const { data } = await this.supabase.from("banners").select("*").eq("tenant_id", tenantId);
        return data ?? [];
    }
};
exports.MarketingService = MarketingService;
exports.MarketingService = MarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MarketingService);
//# sourceMappingURL=marketing.service.js.map