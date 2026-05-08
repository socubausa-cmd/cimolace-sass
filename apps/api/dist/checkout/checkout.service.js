"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
const common_1 = require("@nestjs/common");
let CheckoutService = class CheckoutService {
    async createSession(data) {
        return { checkoutUrl: "https://checkout.stripe.com/pay/cs_test_placeholder", sessionId: "cs_" + Date.now(), amount: data.priceCents, currency: data.currency };
    }
    async handleWebhook(event) {
        return { received: true, type: event.type };
    }
};
exports.CheckoutService = CheckoutService;
exports.CheckoutService = CheckoutService = __decorate([
    (0, common_1.Injectable)()
], CheckoutService);
//# sourceMappingURL=checkout.service.js.map