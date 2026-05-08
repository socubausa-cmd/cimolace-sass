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
exports.CimolaceController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const service_catalog_service_1 = require("./service-catalog.service");
const feature_gate_service_1 = require("./feature-gate.service");
let CimolaceController = class CimolaceController {
    constructor(catalog, gate) {
        this.catalog = catalog;
        this.gate = gate;
    }
    async getCatalog() { return { data: this.catalog.getCatalog() }; }
    async getTemplates() { return { data: this.catalog.getTemplates() }; }
    async getTenantServices(req) { return { data: await this.catalog.getTenantServices(req.tenant.id) }; }
    async toggle(req, key, b) { return { data: await this.catalog.toggleService(req.tenant.id, key, b.active) }; }
    async activateTemplate(req, type) { return { data: await this.gate.activateTemplate(req.tenant.id, type) }; }
};
exports.CimolaceController = CimolaceController;
__decorate([
    (0, common_1.Get)("catalog"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CimolaceController.prototype, "getCatalog", null);
__decorate([
    (0, common_1.Get)("templates"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CimolaceController.prototype, "getTemplates", null);
__decorate([
    (0, common_1.Get)("services"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CimolaceController.prototype, "getTenantServices", null);
__decorate([
    (0, common_1.Post)("services/:key/toggle"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CimolaceController.prototype, "toggle", null);
__decorate([
    (0, common_1.Post)("activate-template/:type"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("type")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CimolaceController.prototype, "activateTemplate", null);
exports.CimolaceController = CimolaceController = __decorate([
    (0, common_1.Controller)("cimolace"),
    __metadata("design:paramtypes", [service_catalog_service_1.ServiceCatalogService, feature_gate_service_1.FeatureGateService])
], CimolaceController);
//# sourceMappingURL=cimolace.controller.js.map