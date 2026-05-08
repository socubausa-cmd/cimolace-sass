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
exports.PatientRecordService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let PatientRecordService = class PatientRecordService {
    constructor(authService) {
        this.authService = authService;
    }
    async create(tenantId, data) {
        const supabase = this.authService.getClient();
        const { data: record, error } = await supabase.from("patient_records").insert({ tenant_id: tenantId, ...data }).select().single();
        if (error)
            throw error;
        return record;
    }
    async findAll(tenantId) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("patient_records").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async findOne(tenantId, id) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("patient_records").select("*").eq("tenant_id", tenantId).eq("id", id).single();
        if (!data)
            throw new common_1.NotFoundException("Patient not found");
        return data;
    }
    async update(tenantId, id, updates) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("patient_records").update(updates).eq("tenant_id", tenantId).eq("id", id).select().single();
        if (!data)
            throw new common_1.NotFoundException("Patient not found");
        return data;
    }
};
exports.PatientRecordService = PatientRecordService;
exports.PatientRecordService = PatientRecordService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], PatientRecordService);
//# sourceMappingURL=patient-record.service.js.map