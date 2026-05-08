"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const live_service_1 = require("./live.service");
const live_controller_1 = require("./live.controller");
let LiveModule = class LiveModule {
};
exports.LiveModule = LiveModule;
exports.LiveModule = LiveModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, tenant_module_1.TenantModule], controllers: [live_controller_1.LiveController], providers: [live_service_1.LiveService] })
], LiveModule);
//# sourceMappingURL=live.module.js.map