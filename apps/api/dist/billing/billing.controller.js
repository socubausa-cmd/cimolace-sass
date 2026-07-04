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
exports.BillingCronController = exports.AdminBillingController = exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const cimolace_staff_guard_1 = require("../cimolace-backoffice/cimolace-staff.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const billing_service_1 = require("./billing.service");
let BillingController = class BillingController {
    constructor(svc) {
        this.svc = svc;
    }
    async getSubscription(req) { return { data: await this.svc.getSubscription(req.tenant.id) }; }
    async create(req, b) { return { data: await this.svc.createSubscription(req.tenant.id, b.plan, b.provider) }; }
    async getInvoices(req) { return { data: await this.svc.getInvoices(req.tenant.id) }; }
    async plan(req) { return this.svc.getTenantSubscription(req.tenant.id); }
    async subscribe(req, b) {
        return this.svc.subscribeToPlan(req.tenant.id, b?.planKey ?? "", b?.provider);
    }
    async collect(req, id, b) {
        return this.svc.collectSubscriptionViaPawaPay(req.tenant.id, id, b);
    }
    async syncMobileMoney(req) {
        return this.svc.syncPendingPawaPayDeposits(req.tenant.id);
    }
    async refund(req, id) {
        return this.svc.refundSubscriptionPayment(req.tenant.id, id);
    }
    async syncRefunds(req) {
        return this.svc.syncPendingRefunds(req.tenant.id);
    }
    async cardCheckout(req, id) {
        return this.svc.createCardCheckout(req.tenant.id, id);
    }
    async cardConfirm(req, id) {
        return this.svc.confirmCardPayment(req.tenant.id, id);
    }
    async listPayouts(req) { return this.svc.listPayouts(req.tenant.id); }
    async balance(req) { return this.svc.getBalance(req.tenant.id); }
    async createPayout(req, b) {
        return this.svc.createPayout(req.tenant.id, req.user?.id ?? null, b);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)("subscription"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Post)("subscription"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("invoices"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getInvoices", null);
__decorate([
    (0, common_1.Get)("plan"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "plan", null);
__decorate([
    (0, common_1.Post)("subscribe"),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)("subscriptions/:id/collect"),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "collect", null);
__decorate([
    (0, common_1.Post)("mobile-money/sync"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "syncMobileMoney", null);
__decorate([
    (0, common_1.Post)("subscriptions/:id/refund"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "refund", null);
__decorate([
    (0, common_1.Post)("refunds/sync"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "syncRefunds", null);
__decorate([
    (0, common_1.Post)("subscriptions/:id/card-checkout"),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "cardCheckout", null);
__decorate([
    (0, common_1.Post)("subscriptions/:id/card-confirm"),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "cardConfirm", null);
__decorate([
    (0, common_1.Get)("payouts"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "listPayouts", null);
__decorate([
    (0, common_1.Get)("balance"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "balance", null);
__decorate([
    (0, common_1.Post)("payouts"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("owner", "admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "createPayout", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)("billing"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
let AdminBillingController = class AdminBillingController {
    constructor(svc) {
        this.svc = svc;
    }
    async activate(tenantId, body) {
        return { data: await this.svc.activateTenantSubscription(tenantId, body?.plan || "zahir-forfait") };
    }
};
exports.AdminBillingController = AdminBillingController;
__decorate([
    (0, common_1.Post)("tenants/:tenantId/activate"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, cimolace_staff_guard_1.CimolaceStaffGuard),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminBillingController.prototype, "activate", null);
exports.AdminBillingController = AdminBillingController = __decorate([
    (0, common_1.Controller)("admin/billing"),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], AdminBillingController);
let BillingCronController = class BillingCronController {
    constructor(svc) {
        this.svc = svc;
    }
    runRenewals(key) {
        const expected = process.env.INTERNAL_CRON_KEY;
        if (!expected || key !== expected)
            throw new common_1.UnauthorizedException("Clé interne invalide");
        return this.svc.renewDueSubscriptions();
    }
};
exports.BillingCronController = BillingCronController;
__decorate([
    (0, common_1.Post)("renewals/run"),
    __param(0, (0, common_1.Headers)("x-internal-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BillingCronController.prototype, "runRenewals", null);
exports.BillingCronController = BillingCronController = __decorate([
    (0, common_1.Controller)("billing"),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingCronController);
//# sourceMappingURL=billing.controller.js.map