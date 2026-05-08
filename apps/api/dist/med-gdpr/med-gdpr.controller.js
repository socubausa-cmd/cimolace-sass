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
exports.MedGdprController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const med_gdpr_service_1 = require("./med-gdpr.service");
let MedGdprController = class MedGdprController {
    constructor(svc) {
        this.svc = svc;
    }
    async export(req, id) { return { data: await this.svc.exportPatientData(req.tenant.id, id) }; }
    async anonymize(req, id) { return { data: await this.svc.anonymize(req.tenant.id, id) }; }
};
exports.MedGdprController = MedGdprController;
__decorate([
    (0, common_1.Get)("export/:recordId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("recordId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedGdprController.prototype, "export", null);
__decorate([
    (0, common_1.Post)("anonymize/:recordId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("recordId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedGdprController.prototype, "anonymize", null);
exports.MedGdprController = MedGdprController = __decorate([
    (0, common_1.Controller)("med/gdpr"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [med_gdpr_service_1.MedGdprService])
], MedGdprController);
//# sourceMappingURL=med-gdpr.controller.js.map