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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTenantServicesController = exports.TenantController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const cimolace_staff_guard_1 = require("../cimolace-backoffice/cimolace-staff.guard");
const tenant_service_1 = require("./tenant.service");
const update_branding_dto_1 = require("./update-branding.dto");
const update_tenant_settings_dto_1 = require("./update-tenant-settings.dto");
let TenantController = class TenantController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async current(req) {
        return { data: req.tenant };
    }
    async mine(req) {
        const memberships = await this.tenantService.getMineForUser(req.user.id);
        return { data: memberships };
    }
    async join(req, slug) {
        const fromPlatformHost = (0, tenant_service_1.isPlatformOrigin)(req.headers?.origin || req.headers?.referer);
        const result = await this.tenantService.joinAsStudent(req.user.id, slug, fromPlatformHost);
        if (!result)
            throw new common_1.NotFoundException("École introuvable ou inactive.");
        return { data: result };
    }
    async brandingBySlug(slug) {
        const tenant = await this.tenantService.getTenantBySlug(slug);
        if (!tenant) {
            return null;
        }
        const t = tenant;
        return {
            slug: t.slug,
            name: t.name ?? slug,
            logo_url: t.logo_url ?? null,
            brand_colors: t.brand_colors ?? {},
            site: t.metadata?.site ?? null,
            requiresStudentDossier: t.metadata?.settings?.requiresStudentDossier ?? null,
            embedded: (0, tenant_service_1.isEmbeddedTenant)(tenant),
            primary_domain: t.primary_domain ?? null,
        };
    }
    async brandingByHost(host) {
        const tenant = await this.tenantService.getTenantByHost(host);
        if (!tenant) {
            return null;
        }
        const t = tenant;
        return {
            slug: t.slug,
            name: t.name ?? t.slug,
            logo_url: t.logo_url ?? null,
            brand_colors: t.brand_colors ?? {},
            requiresStudentDossier: t.metadata?.settings?.requiresStudentDossier ?? null,
        };
    }
    async updateOwnBranding(req, dto) {
        return {
            data: await this.tenantService.updateBranding(req.tenant.id, dto),
        };
    }
    async updateOwnSettings(req, dto) {
        return {
            data: await this.tenantService.updateTenantSettings(req.tenant.id, dto),
        };
    }
    async updateBranding(tenantId, dto) {
        return {
            data: await this.tenantService.updateBranding(tenantId, dto),
        };
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Get)("current"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "current", null);
__decorate([
    (0, common_1.Get)("mine"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "mine", null);
__decorate([
    (0, common_1.Post)(":slug/join"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "join", null);
__decorate([
    (0, common_1.Get)("by-slug/:slug/branding"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "brandingBySlug", null);
__decorate([
    (0, common_1.Get)("by-host/:host/branding"),
    __param(0, (0, common_1.Param)("host")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "brandingByHost", null);
__decorate([
    (0, common_1.Patch)("current/branding"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_branding_dto_1.UpdateBrandingDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateOwnBranding", null);
__decorate([
    (0, common_1.Patch)("current/settings"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_tenant_settings_dto_1.UpdateTenantSettingsDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateOwnSettings", null);
__decorate([
    (0, common_1.Patch)(":tenantId/branding"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, cimolace_staff_guard_1.CimolaceStaffGuard),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_branding_dto_1.UpdateBrandingDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateBranding", null);
exports.TenantController = TenantController = __decorate([
    (0, common_1.Controller)("tenants"),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], TenantController);
let AdminTenantServicesController = class AdminTenantServicesController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async toggleService(tenantId, serviceKey, body) {
        if (typeof body?.active !== "boolean") {
            throw new common_1.BadRequestException("Body { active: boolean } requis");
        }
        return {
            data: await this.tenantService.updateTenantService(tenantId, serviceKey, body.active),
        };
    }
};
exports.AdminTenantServicesController = AdminTenantServicesController;
__decorate([
    (0, common_1.Post)(":tenantId/services/:serviceKey/toggle"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, cimolace_staff_guard_1.CimolaceStaffGuard),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("serviceKey")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminTenantServicesController.prototype, "toggleService", null);
exports.AdminTenantServicesController = AdminTenantServicesController = __decorate([
    (0, common_1.Controller)("admin/tenants"),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], AdminTenantServicesController);
//# sourceMappingURL=tenant.controller.js.map