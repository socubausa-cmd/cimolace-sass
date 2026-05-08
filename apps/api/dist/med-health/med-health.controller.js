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
exports.MedHealthController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const med_health_service_1 = require("./med-health.service");
let MedHealthController = class MedHealthController {
    constructor(svc) {
        this.svc = svc;
    }
    async create(req, b) { return { data: await this.svc.create(req.tenant.id, { ...b, patient_user_id: req.user.id }) }; }
    async findByPatient(req, id) { return { data: await this.svc.findByPatient(req.tenant.id, id) }; }
};
exports.MedHealthController = MedHealthController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MedHealthController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("patient/:patientId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("patientId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedHealthController.prototype, "findByPatient", null);
exports.MedHealthController = MedHealthController = __decorate([
    (0, common_1.Controller)("med/health"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [med_health_service_1.MedHealthService])
], MedHealthController);
//# sourceMappingURL=med-health.controller.js.map