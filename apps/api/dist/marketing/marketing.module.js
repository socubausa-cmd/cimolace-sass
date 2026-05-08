"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const marketing_service_1 = require("./marketing.service");
const marketing_controller_1 = require("./marketing.controller");
let MarketingModule = class MarketingModule {
};
exports.MarketingModule = MarketingModule;
exports.MarketingModule = MarketingModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule], controllers: [marketing_controller_1.MarketingController], providers: [marketing_service_1.MarketingService] })
], MarketingModule);
//# sourceMappingURL=marketing.module.js.map