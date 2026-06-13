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
const supabase_module_1 = require("../supabase/supabase.module");
const tenant_module_1 = require("../tenant/tenant.module");
const marketing_service_1 = require("./marketing.service");
const marketing_controller_1 = require("./marketing.controller");
const marketing_advanced_controller_1 = require("./marketing-advanced.controller");
const marketing_advanced_service_1 = require("./marketing-advanced.service");
let MarketingModule = class MarketingModule {
};
exports.MarketingModule = MarketingModule;
exports.MarketingModule = MarketingModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule, supabase_module_1.SupabaseModule],
        controllers: [marketing_controller_1.MarketingController, marketing_advanced_controller_1.MarketingAdvancedController],
        providers: [marketing_service_1.MarketingService, marketing_advanced_service_1.MarketingAdvancedService],
        exports: [marketing_service_1.MarketingService, marketing_advanced_service_1.MarketingAdvancedService],
    })
], MarketingModule);
//# sourceMappingURL=marketing.module.js.map