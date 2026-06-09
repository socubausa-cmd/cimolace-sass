"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const supabase_module_1 = require("../supabase/supabase.module");
const cimolace_staff_guard_1 = require("../cimolace-backoffice/cimolace-staff.guard");
const tenant_service_1 = require("./tenant.service");
const tenant_controller_1 = require("./tenant.controller");
const tenant_api_key_controller_1 = require("./tenant-api-key.controller");
const tenant_portal_controller_1 = require("./tenant-portal.controller");
let TenantModule = class TenantModule {
};
exports.TenantModule = TenantModule;
exports.TenantModule = TenantModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, supabase_module_1.SupabaseModule],
        controllers: [
            tenant_controller_1.TenantController,
            tenant_api_key_controller_1.TenantApiKeyController,
            tenant_portal_controller_1.TenantPortalController,
            tenant_controller_1.AdminTenantServicesController,
        ],
        providers: [tenant_service_1.TenantService, cimolace_staff_guard_1.CimolaceStaffGuard],
        exports: [tenant_service_1.TenantService],
    })
], TenantModule);
//# sourceMappingURL=tenant.module.js.map