"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureGateService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let FeatureGateService = class FeatureGateService {
    constructor(auth) {
        this.auth = auth;
    }
    async isServiceActive(tenantId, serviceKey) {
        const supabase = this.auth.getClient();
        const { data } = await supabase.from("tenant_services").select("active").eq("tenant_id", tenantId).eq("service_key", serviceKey).single();
        return data?.active ?? false;
    }
    async assertServiceActive(tenantId, serviceKey) {
        const active = await this.isServiceActive(tenantId, serviceKey);
        if (!active)
            throw new common_1.ForbiddenException(`Service ${serviceKey} is not active for this tenant`);
    }
    async activateTemplate(tenantId, templateType) {
        const { INFRA_TEMPLATES } = await Promise.resolve().then(() => __importStar(require("./service-catalog.service")));
        const template = INFRA_TEMPLATES.find((t) => t.type === templateType);
        if (!template)
            throw new Error("Template not found");
        const supabase = this.auth.getClient();
        for (const engine of template.engines) {
            await supabase.from("tenant_services").upsert({ tenant_id: tenantId, service_key: engine, active: true }, { onConflict: "tenant_id,service_key" });
        }
        return { activated: template.engines.length, engines: template.engines };
    }
};
exports.FeatureGateService = FeatureGateService;
exports.FeatureGateService = FeatureGateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], FeatureGateService);
//# sourceMappingURL=feature-gate.service.js.map