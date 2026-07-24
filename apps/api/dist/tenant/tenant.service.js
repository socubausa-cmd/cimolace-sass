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
const liri_entitlements_service_1 = require("../billing/liri-entitlements.service");
const tenant_slug_aliases_1 = require("./tenant-slug-aliases");
function isEmbeddedTenant(tenant) {
    const mode = tenant?.metadata?.hosting_mode;
    if (mode === "embedded")
        return true;
    if (mode === "hosted" || mode === "customized")
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
    constructor(authService, entitlements) {
        this.authService = authService;
        this.entitlements = entitlements;
    }
    async resolveTenant(userId, tenantSlug) {
        const supabase = this.authService.getClient();
        if (tenantSlug) {
            const resolvedSlug = (0, tenant_slug_aliases_1.canonicalTenantSlug)(tenantSlug);
            const { data: tenant } = await supabase
                .from("tenants")
                .select("*")
                .eq("slug", resolvedSlug)
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
            if (!role)
                return null;
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
    async resolveTenantAllowNonMember(userId, tenantSlug) {
        if (!tenantSlug)
            return null;
        const supabase = this.authService.getClient();
        const resolvedSlug = (0, tenant_slug_aliases_1.canonicalTenantSlug)(tenantSlug);
        const { data: tenant } = await supabase
            .from("tenants")
            .select("*")
            .eq("slug", resolvedSlug)
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
    async joinAsStudent(userId, slug, fromPlatformHost = false) {
        const supabase = this.authService.getClient();
        const resolvedSlug = (0, tenant_slug_aliases_1.canonicalTenantSlug)(slug);
        const { data: tenant } = await supabase
            .from("tenants")
            .select("id, name, slug, status, primary_domain, metadata")
            .eq("slug", resolvedSlug)
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
        const { count: studentCount } = await supabase
            .from("tenant_memberships")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("role", "student")
            .eq("status", "active");
        await this.entitlements.assertWithinCap(tenantId, "students", studentCount ?? 0);
        const { error } = await supabase
            .from("tenant_memberships")
            .insert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active" });
        if (error)
            return { ok: true, joined: false };
        void this.sendWelcome(tenantId, userId, tenant).catch(() => undefined);
        return { ok: true, joined: true, role: "student" };
    }
    async sendWelcome(tenantId, userId, tenant) {
        const supabase = this.authService.getClient();
        const schoolName = tenant?.name || tenant?.slug || "votre école";
        const portalUrl = tenant?.primary_domain ? `https://${tenant.primary_domain}/liri` : "/liri";
        try {
            await supabase.from("notifications").insert({
                tenant_id: tenantId,
                user_id: userId,
                type: "success",
                is_read: false,
                title: `Bienvenue chez ${schoolName} !`,
                body: "Votre espace est prêt : découvrez les cours, le forum et les lives depuis votre portail.",
                action_url: "/liri",
            });
        }
        catch { }
        try {
            const { data: u } = await supabase.auth.admin.getUserById(userId);
            const email = u?.user?.email;
            if (!email)
                return;
            const { data: ns } = await supabase
                .from("tenant_notification_settings")
                .select("email_from, email_from_name")
                .eq("tenant_id", tenantId)
                .maybeSingle();
            await supabase.from("email_queue").insert({
                tenant_id: tenantId,
                to: email,
                from: ns?.email_from ?? null,
                from_name: ns?.email_from_name ?? null,
                subject: `Bienvenue chez ${schoolName} !`,
                html_body: `<h2>Bienvenue chez ${schoolName} !</h2>` +
                    `<p>Votre compte est actif : vos cours, le forum, la messagerie et les lives vous attendent.</p>` +
                    `<p><a href="${portalUrl}" style="display:inline-block;padding:10px 22px;background:#d97757;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ouvrir mon espace</a></p>` +
                    `<p style="color:#777;font-size:13px;">Si le bouton ne fonctionne pas, connectez-vous depuis le site de ${schoolName}.</p>`,
            });
        }
        catch { }
    }
    async getTenantBySlug(slug) {
        const supabase = this.authService.getClient();
        const resolvedSlug = (0, tenant_slug_aliases_1.canonicalTenantSlug)(slug);
        const { data } = await supabase
            .from("tenants")
            .select("slug, name, logo_url, brand_colors, status, metadata, primary_domain")
            .eq("slug", resolvedSlug)
            .single();
        if (!data || data.status !== "active")
            return null;
        return data;
    }
    async getActiveTenantIdBySlug(slug) {
        const supabase = this.authService.getClient();
        const resolvedSlug = (0, tenant_slug_aliases_1.canonicalTenantSlug)(slug);
        const { data } = await supabase
            .from("tenants")
            .select("id, status")
            .eq("slug", resolvedSlug)
            .maybeSingle();
        if (!data || data.status !== "active")
            return null;
        return data.id;
    }
    async getPublicCourses(slug) {
        const tenantId = await this.getActiveTenantIdBySlug(slug);
        if (!tenantId)
            return [];
        const supabase = this.authService.getClient();
        const { data } = await supabase
            .from("courses")
            .select("id, title, description, category, price_cents, cycle, duration_weeks, image_url, mode")
            .eq("tenant_id", tenantId)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(24);
        return Array.isArray(data) ? data : [];
    }
    async getPublicOffers(slug) {
        const tenantId = await this.getActiveTenantIdBySlug(slug);
        if (!tenantId)
            return [];
        const supabase = this.authService.getClient();
        const { data } = await supabase
            .from("billing_plans")
            .select("key, label, tagline, description, price_cents, currency, billing_cycle, category, features, sort_order, access_model, metadata")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("price_cents", { ascending: true })
            .limit(100);
        return Array.isArray(data) ? data : [];
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
    async resolveTenantIdByOrigin(host) {
        const supabase = this.authService.getClient();
        const normalized = (host ?? "").trim().toLowerCase();
        if (!normalized)
            return null;
        const { data } = await supabase
            .from("tenant_domains")
            .select("tenant_id, usage")
            .eq("domain", normalized)
            .in("usage", ["custom_host", "embed_origin"])
            .eq("status", "active")
            .order("usage", { ascending: true })
            .limit(1);
        const row = Array.isArray(data) ? data[0] : data;
        return row?.tenant_id ?? null;
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
    async updateTenantService(tenantId, serviceKey, active, actor) {
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
        try {
            await supabase.from("cimolace_change_history").insert({
                action: `service:${active ? "active" : "suspended"}`,
                entity_type: "tenant",
                entity_id: tenantId,
                description: `Moteur ${serviceKey} → ${active ? "actif" : "suspendu"}`,
                changed_by: (actor && actor.trim()) || "Cimolace Ops (non attribué)",
            });
        }
        catch {
        }
        return data;
    }
    async updateBranding(tenantId, dto) {
        const supabase = this.authService.getClient();
        const wantsVisualBranding = dto.logo_url !== undefined || dto.primary_domain !== undefined || dto.brand_colors !== undefined;
        if (wantsVisualBranding) {
            const t = (await this.getTenantById(tenantId));
            if (t?.metadata?.hosting_mode === "hosted") {
                throw new common_1.ForbiddenException("Personnalisation (logo, couleurs, domaine) réservée aux offres Customisé et Intégration.");
            }
        }
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.logo_url !== undefined)
            patch.logo_url = dto.logo_url;
        if (dto.primary_domain !== undefined)
            patch.primary_domain = dto.primary_domain;
        if (dto.brand_colors !== undefined || dto.site !== undefined) {
            const existing = (await this.getTenantById(tenantId));
            if (dto.brand_colors !== undefined) {
                patch.brand_colors = { ...(existing?.brand_colors ?? {}), ...dto.brand_colors };
            }
            if (dto.site !== undefined) {
                const metadata = { ...(existing?.metadata ?? {}) };
                metadata.site = { ...(metadata.site ?? {}), ...dto.site };
                patch.metadata = metadata;
            }
        }
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
    async updateOsKnowledge(tenantId, knowledge) {
        const supabase = this.authService.getClient();
        const tenant = (await this.getTenantById(tenantId));
        const metadata = { ...(tenant?.metadata ?? {}) };
        const existing = {
            ...(metadata.os_knowledge ?? {}),
        };
        metadata.os_knowledge = { ...existing, ...knowledge };
        const { data } = await supabase
            .from("tenants")
            .update({ metadata })
            .eq("id", tenantId)
            .select("*")
            .single();
        return data?.metadata
            ?.os_knowledge ?? null;
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        liri_entitlements_service_1.LiriEntitlementsService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map