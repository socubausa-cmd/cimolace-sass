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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../../auth/auth.service");
let JwtAuthGuard = class JwtAuthGuard {
    constructor(authService) {
        this.authService = authService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Token manquant');
        }
        const token = authHeader.slice(7);
        const medosPayload = this.authService.verifyMedosToken(token);
        if (medosPayload) {
            request.user = {
                id: medosPayload.sub,
                email: medosPayload.email,
                role: medosPayload.role,
                tenant_id: medosPayload.tenant_id,
                tenant_slug: medosPayload.tenant_slug,
                _source: 'medos',
            };
            return true;
        }
        const supabaseUser = await this.authService.verifyToken(token);
        if (supabaseUser) {
            request.user = { ...supabaseUser, _source: 'supabase' };
            return true;
        }
        throw new common_1.UnauthorizedException('Token invalide ou expiré');
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map