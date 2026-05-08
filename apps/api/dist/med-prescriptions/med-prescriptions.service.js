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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedPrescriptionsService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let MedPrescriptionsService = class MedPrescriptionsService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async create(tenantId, data) {
        const { data: rx } = await this.supabase.from("prescriptions").insert({ tenant_id: tenantId, ...data }).select().single();
        return rx;
    }
    async findByRecord(tenantId, recordId) {
        const { data } = await this.supabase.from("prescriptions").select("*").eq("tenant_id", tenantId).eq("record_id", recordId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async sign(tenantId, id) {
        const { data } = await this.supabase.from("prescriptions").update({ is_signed: true, signed_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id).select().single();
        return data;
    }
};
exports.MedPrescriptionsService = MedPrescriptionsService;
exports.MedPrescriptionsService = MedPrescriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MedPrescriptionsService);
//# sourceMappingURL=med-prescriptions.service.js.map