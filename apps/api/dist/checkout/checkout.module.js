"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const pawapay_module_1 = require("../pawapay/pawapay.module");
const tenant_payment_config_module_1 = require("../billing/tenant-payment-config/tenant-payment-config.module");
const checkout_service_1 = require("./checkout.service");
const checkout_controller_1 = require("./checkout.controller");
const offering_checkout_service_1 = require("./offering-checkout.service");
const offering_checkout_controller_1 = require("./offering-checkout.controller");
const subscription_renewal_service_1 = require("./subscription-renewal.service");
let CheckoutModule = class CheckoutModule {
};
exports.CheckoutModule = CheckoutModule;
exports.CheckoutModule = CheckoutModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule, pawapay_module_1.PawaPayModule, tenant_payment_config_module_1.TenantPaymentConfigModule],
        controllers: [checkout_controller_1.CheckoutController, offering_checkout_controller_1.OfferingCheckoutController],
        providers: [checkout_service_1.CheckoutService, offering_checkout_service_1.OfferingCheckoutService, subscription_renewal_service_1.SubscriptionRenewalService],
    })
], CheckoutModule);
//# sourceMappingURL=checkout.module.js.map