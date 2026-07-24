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
exports.TenantGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const allow_non_member_decorator_1 = require("../decorators/allow-non-member.decorator");
const tenant_service_1 = require("../../tenant/tenant.service");
let TenantGuard = class TenantGuard {
    constructor(tenantService, reflector) {
        this.tenantService = tenantService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id;
        if (!userId)
            throw new common_1.ForbiddenException('Utilisateur non authentifié');
        if (request.user?._source === 'medos' && request.user.tenant_id) {
            request.tenant = {
                id: request.user.tenant_id,
                slug: request.user.tenant_slug,
                userRole: request.user.role,
            };
            return true;
        }
        const slug = request.headers['x-tenant-slug'] ?? undefined;
        const allowNonMember = this.reflector.getAllAndOverride(allow_non_member_decorator_1.ALLOW_NON_MEMBER_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) === true;
        const tenant = allowNonMember
            ? await this.tenantService.resolveTenantAllowNonMember(userId, slug)
            : await this.tenantService.resolveTenant(userId, slug);
        if (!tenant)
            throw new common_1.ForbiddenException('Accès tenant refusé');
        request.tenant = tenant;
        return true;
    }
};
exports.TenantGuard = TenantGuard;
exports.TenantGuard = TenantGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_service_1.TenantService,
        core_1.Reflector])
], TenantGuard);
//# sourceMappingURL=tenant.guard.js.map