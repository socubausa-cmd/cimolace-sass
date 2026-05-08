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
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let TenantService = class TenantService {
    constructor(authService) {
        this.authService = authService;
    }
    async resolveTenant(userId, tenantSlug) {
        const supabase = this.authService.getClient();
        if (tenantSlug) {
            const { data: tenant } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).single();
            if (!tenant)
                return null;
            const { data: membership } = await supabase.from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", userId).single();
            return { ...tenant, role: membership?.role ?? null };
        }
        const { data: membership } = await supabase.from("tenant_memberships").select("tenant_id, role, tenants(*)").eq("user_id", userId).single();
        if (!membership)
            return null;
        return { ...membership.tenants, role: membership.role };
    }
    async getTenantById(tenantId) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
        return data;
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map