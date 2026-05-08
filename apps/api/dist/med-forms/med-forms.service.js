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
exports.MedFormsService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let MedFormsService = class MedFormsService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async findAll(tenantId) {
        const { data } = await this.supabase.from("medical_forms").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async findOne(tenantId, id) {
        const { data } = await this.supabase.from("medical_forms").select("*").eq("tenant_id", tenantId).eq("id", id).single();
        return data;
    }
    async create(tenantId, dto) {
        const { data } = await this.supabase.from("medical_forms").insert({ tenant_id: tenantId, ...dto }).select().single();
        return data;
    }
    async submitResponse(tenantId, formId, patientId, responses) {
        const { data } = await this.supabase.from("form_responses").insert({ tenant_id: tenantId, form_id: formId, patient_id: patientId, responses }).select().single();
        return data;
    }
    async getResponses(tenantId, formId) {
        const { data } = await this.supabase.from("form_responses").select("*").eq("tenant_id", tenantId).eq("form_id", formId);
        return data ?? [];
    }
};
exports.MedFormsService = MedFormsService;
exports.MedFormsService = MedFormsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MedFormsService);
//# sourceMappingURL=med-forms.service.js.map