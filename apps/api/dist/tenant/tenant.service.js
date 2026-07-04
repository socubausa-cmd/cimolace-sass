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
exports.isEmbeddedTenant = isEmbeddedTenant;
exports.isPlatformOrigin = isPlatformOrigin;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
function isEmbeddedTenant(tenant) {
    const mode = tenant?.metadata?.hosting_mode;
    if (mode === "embedded")
        return true;
    if (mode === "hosted")
        return false;
    return !!tenant?.primary_domain;
}
function isPlatformOrigin(originOrReferer) {
    const s = String(originOrReferer || "").toLowerCase();
    if (!s)
        return false;
    return /(^|\/\/|\.)cimolace\.space([/:]|$)/.test(s) || /localhost|127\.0\.0\.1/.test(s);
}
let TenantService = class TenantService {
    constructor(authService) {
        this.authService = authService;
    }
    async resolveTenant(userId, tenantSlug) {
        const supabase = this.authService.getClient();
        if (tenantSlug) {
            const { data: tenant } = await supabase
                .from("tenants")
                .select("*")
                .eq("slug", tenantSlug)
                .single();
            if (!tenant)
                return null;
            const { data: membership } = await supabase
                .from("tenant_memberships")
                .select("role")
                .eq("tenant_id", tenant.id)
                .eq("user_id", userId)
                .eq("status", "active")
                .single();
            const role = (membership?.role ?? null);
            return {
                ...tenant,
                role,
                userRole: role,
                data_region: tenant.data_region ?? "global",
            };
        }
        const { data: membership } = await supabase
            .from("tenant_memberships")
            .select("tenant_id, role, tenants(*)")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();
        if (!membership)
            return null;
        const role = membership.role;
        const tenant = membership.tenants;
        return {
            ...tenant,
            role,
            userRole: role,
            data_region: tenant?.data_region ?? "global",
        };
    }
    async resolveForUser(slug, userId) {
        return this.resolveTenant(userId, slug);
    }
    async joinAsStudent(userId, slug, fromPlatformHost = false) {
        const supabase = this.authService.getClient();
        const { data: tenant } = await supabase
            .from("tenants")
            .select("id, status, primary_domain, metadata")
            .eq("slug", slug)
            .single();
        if (!tenant || tenant.status !== "active")
            return null;
        if (fromPlatformHost && isEmbeddedTenant(tenant))
            return null;
        const tenantId = tenant.id;
        const { data: existing } = await supabase
            .from("tenant_memberships")
            .select("id, role, status")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .maybeSingle();
        if (existing?.id) {
            if (existing.status !== "active") {
                await supabase
                    .from("tenant_memberships")
                    .update({ status: "active" })
                    .eq("id", existing.id);
            }
            return { ok: true, joined: false, role: existing.role };
        }
        const { error } = await supabase
            .from("tenant_memberships")
            .insert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active" });
        if (error)
            return { ok: true, joined: false };
        return { ok: true, joined: true, role: "student" };
    }
    async getTenantBySlug(slug) {
        const supabase = this.authService.getClient();
        const { data } = await supabase
            .from("tenants")
            .select("slug, name, logo_url, brand_colors, status, metadata, primary_domain")
            .eq("slug", slug)
            .single();
        if (!data || data.status !== "active")
            return null;
        return data;
    }
    async getTenantByHost(host) {
        const supabase = this.authService.getClient();
        const normalized = (host ?? "").trim().toLowerCase();
        if (!normalized)
            return null;
        const { data: domainRow } = await supabase
            .from("tenant_domains")
            .select("tenant_id")
            .eq("domain", normalized)
            .eq("usage", "custom_host")
            .eq("status", "active")
            .maybeSingle();
        const tenantId = domainRow?.tenant_id;
        if (!tenantId)
            return null;
        const { data } = await supabase
            .from("tenants")
            .select("slug, name, logo_url, brand_colors, status, metadata")
            .eq("id", tenantId)
            .single();
        if (!data || data.status !== "active")
            return null;
        return data;
    }
    async getMineForUser(userId) {
        const supabase = this.authService.getClient();
        const { data, error } = await supabase
            .from("tenant_memberships")
            .select("role, status, tenants(id, slug, name, infrastructure_type, status, logo_url)")
            .eq("user_id", userId)
            .eq("status", "active");
        if (error || !data)
            return [];
        return data.map((row) => ({
            role: row.role,
            slug: row.tenants?.slug ?? null,
            name: row.tenants?.name ?? null,
            infrastructure_type: row.tenants?.infrastructure_type ?? null,
            status: row.tenants?.status ?? null,
            logo_url: row.tenants?.logo_url ?? null,
            tenants: row.tenants ?? null,
        }));
    }
    async getTenantById(tenantId) {
        const supabase = this.authService.getClient();
        const { data } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", tenantId)
            .single();
        return data;
    }
    async updateTenantService(tenantId, serviceKey, active) {
        const supabase = this.authService.getClient();
        const { data, error } = await supabase
            .from("tenant_services")
            .upsert({
            tenant_id: tenantId,
            service_key: serviceKey,
            active,
        }, { onConflict: "tenant_id,service_key" })
            .select("*")
            .single();
        if (error) {
            throw new Error(`Mise à jour service ${serviceKey} impossible pour tenant ${tenantId}: ${error.message}`);
        }
        return data;
    }
    async updateBranding(tenantId, dto) {
        const supabase = this.authService.getClient();
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.logo_url !== undefined)
            patch.logo_url = dto.logo_url;
        if (dto.primary_domain !== undefined)
            patch.primary_domain = dto.primary_domain;
        if (dto.brand_colors !== undefined)
            patch.brand_colors = dto.brand_colors;
        if (Object.keys(patch).length === 0) {
            return this.getTenantById(tenantId);
        }
        const { data } = await supabase
            .from("tenants")
            .update(patch)
            .eq("id", tenantId)
            .select("*")
            .single();
        return data;
    }
    async updateTenantSettings(tenantId, dto) {
        const supabase = this.authService.getClient();
        const tenant = (await this.getTenantById(tenantId));
        const metadata = { ...(tenant?.metadata ?? {}) };
        const settings = { ...(metadata.settings ?? {}) };
        if (dto.requiresStudentDossier !== undefined) {
            settings.requiresStudentDossier = dto.requiresStudentDossier;
        }
        metadata.settings = settings;
        const { data } = await supabase
            .from("tenants")
            .update({ metadata })
            .eq("id", tenantId)
            .select("*")
            .single();
        return data;
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map