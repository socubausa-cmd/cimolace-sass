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
exports.MedProgramsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const med_programs_service_1 = require("./med-programs.service");
let MedProgramsController = class MedProgramsController {
    constructor(svc) {
        this.svc = svc;
    }
    async findAll(req) { return { data: await this.svc.findAll(req.tenant.id) }; }
    async create(req, b) { return { data: await this.svc.create(req.tenant.id, b) }; }
    async addStep(id, b) { return { data: await this.svc.addStep(id, b) }; }
    async assign(req, id, b) { return { data: await this.svc.assign(req.tenant.id, id, b.patient_id, b.record_id) }; }
    async findByPatient(req, pid) { return { data: await this.svc.findByPatient(req.tenant.id, pid) }; }
};
exports.MedProgramsController = MedProgramsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MedProgramsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MedProgramsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(":id/steps"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MedProgramsController.prototype, "addStep", null);
__decorate([
    (0, common_1.Post)(":id/assign"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MedProgramsController.prototype, "assign", null);
__decorate([
    (0, common_1.Get)("patient/:patientId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("patientId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MedProgramsController.prototype, "findByPatient", null);
exports.MedProgramsController = MedProgramsController = __decorate([
    (0, common_1.Controller)("med/programs"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [med_programs_service_1.MedProgramsService])
], MedProgramsController);
//# sourceMappingURL=med-programs.controller.js.map