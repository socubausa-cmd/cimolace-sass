"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedProgramsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const med_programs_service_1 = require("./med-programs.service");
const med_programs_controller_1 = require("./med-programs.controller");
let MedProgramsModule = class MedProgramsModule {
};
exports.MedProgramsModule = MedProgramsModule;
exports.MedProgramsModule = MedProgramsModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule], controllers: [med_programs_controller_1.MedProgramsController], providers: [med_programs_service_1.MedProgramsService] })
], MedProgramsModule);
//# sourceMappingURL=med-programs.module.js.map