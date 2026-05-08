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
exports.MedProgramsService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let MedProgramsService = class MedProgramsService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async findAll(tenantId) {
        const { data } = await this.supabase.from("care_programs").select("*").eq("tenant_id", tenantId);
        return data ?? [];
    }
    async create(tenantId, dto) {
        const { data } = await this.supabase.from("care_programs").insert({ tenant_id: tenantId, ...dto }).select().single();
        return data;
    }
    async addStep(programId, step) {
        const { data } = await this.supabase.from("care_program_steps").insert({ program_id: programId, ...step }).select().single();
        return data;
    }
    async assign(tenantId, programId, patientId, recordId) {
        const { data } = await this.supabase.from("patient_programs").insert({ tenant_id: tenantId, program_id: programId, patient_id: patientId, record_id: recordId, start_date: new Date().toISOString().split("T")[0] }).select().single();
        return data;
    }
    async findByPatient(tenantId, patientId) {
        const { data } = await this.supabase.from("patient_programs").select("*, care_programs(*)").eq("tenant_id", tenantId).eq("patient_id", patientId);
        return data ?? [];
    }
};
exports.MedProgramsService = MedProgramsService;
exports.MedProgramsService = MedProgramsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MedProgramsService);
//# sourceMappingURL=med-programs.service.js.map