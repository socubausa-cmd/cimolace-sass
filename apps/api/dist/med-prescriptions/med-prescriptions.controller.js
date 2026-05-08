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
exports.MedPrescriptionsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const med_prescriptions_service_1 = require("./med-prescriptions.service");
let MedPrescriptionsController = class MedPrescriptionsController {
    constructor(svc) {
        this.svc = svc;
    }
    async create(req, b) { return { data: await this.svc.create(req.tenant.id, { ...b, practitioner_id: req.user.id }) }; }
    async findByRecord(req, rid) { return { data: await this.svc.findByRecord(req.tenant.id, rid) }; }
    async sign(req, id) { return { data: await this.svc.sign(req.tenant.id, id) }; }
};
exports.MedPrescriptionsController = MedPrescriptionsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MedPrescriptionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("record/:recordId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("recordId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedPrescriptionsController.prototype, "findByRecord", null);
__decorate([
    (0, common_1.Post)(":id/sign"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedPrescriptionsController.prototype, "sign", null);
exports.MedPrescriptionsController = MedPrescriptionsController = __decorate([
    (0, common_1.Controller)("med/prescriptions"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [med_prescriptions_service_1.MedPrescriptionsService])
], MedPrescriptionsController);
//# sourceMappingURL=med-prescriptions.controller.js.map