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
exports.ConsultationNoteController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const consultation_note_service_1 = require("./consultation-note.service");
let ConsultationNoteController = class ConsultationNoteController {
    constructor(service) {
        this.service = service;
    }
    async findByRecord(req, recordId) {
        return { data: await this.service.findByRecord(req.tenant.id, recordId) };
    }
    async create(req, recordId, body) {
        return { data: await this.service.create(req.tenant.id, { ...body, record_id: recordId, practitioner_id: req.user.id }) };
    }
    async update(req, id, body) {
        return { data: await this.service.update(req.tenant.id, id, body) };
    }
    async sign(req, id) {
        return { data: await this.service.sign(req.tenant.id, id) };
    }
    async share(req, id, body) {
        return { data: await this.service.share(req.tenant.id, id, body.is_shared) };
    }
};
exports.ConsultationNoteController = ConsultationNoteController;
__decorate([
    (0, common_1.Get)("patients/:recordId/notes"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("recordId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsultationNoteController.prototype, "findByRecord", null);
__decorate([
    (0, common_1.Post)("patients/:recordId/notes"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("recordId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ConsultationNoteController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)("notes/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ConsultationNoteController.prototype, "update", null);
__decorate([
    (0, common_1.Post)("notes/:id/sign"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsultationNoteController.prototype, "sign", null);
__decorate([
    (0, common_1.Patch)("notes/:id/share"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ConsultationNoteController.prototype, "share", null);
exports.ConsultationNoteController = ConsultationNoteController = __decorate([
    (0, common_1.Controller)("med"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [consultation_note_service_1.ConsultationNoteService])
], ConsultationNoteController);
//# sourceMappingURL=consultation-note.controller.js.map