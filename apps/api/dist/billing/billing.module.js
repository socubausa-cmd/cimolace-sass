"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const supabase_module_1 = require("../supabase/supabase.module");
const pawapay_module_1 = require("../pawapay/pawapay.module");
const billing_service_1 = require("./billing.service");
const billing_controller_1 = require("./billing.controller");
const billing_webhook_controller_1 = require("./billing-webhook.controller");
const billing_advanced_controller_1 = require("./billing-advanced.controller");
const billing_advanced_service_1 = require("./billing-advanced.service");
const webhook_service_1 = require("../liri-public/webhook.service");
const tenant_payment_config_module_1 = require("./tenant-payment-config/tenant-payment-config.module");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule, supabase_module_1.SupabaseModule, pawapay_module_1.PawaPayModule, tenant_payment_config_module_1.TenantPaymentConfigModule],
        controllers: [billing_controller_1.BillingController, billing_controller_1.AdminBillingController, billing_webhook_controller_1.BillingWebhookController, billing_advanced_controller_1.BillingAdvancedController],
        providers: [billing_service_1.BillingService, billing_advanced_service_1.BillingAdvancedService, webhook_service_1.WebhookService],
        exports: [billing_service_1.BillingService, billing_advanced_service_1.BillingAdvancedService],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map