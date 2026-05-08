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
exports.MedGdprService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let MedGdprService = class MedGdprService {
    constructor(auth) {
        this.auth = auth;
    }
    get supabase() { return this.auth.getClient(); }
    async exportPatientData(tenantId, recordId) {
        const supabase = this.supabase;
        const [record, notes, prescriptions, forms, health] = await Promise.all([
            supabase.from("patient_records").select("*").eq("tenant_id", tenantId).eq("id", recordId).single(),
            supabase.from("consultation_notes").select("*").eq("tenant_id", tenantId).eq("record_id", recordId),
            supabase.from("prescriptions").select("*").eq("tenant_id", tenantId).eq("record_id", recordId),
            supabase.from("form_responses").select("*").eq("tenant_id", tenantId).eq("record_id", recordId),
            supabase.from("health_entries").select("*").eq("tenant_id", tenantId),
        ]);
        return {
            patient: record.data,
            notes: notes.data ?? [],
            prescriptions: prescriptions.data ?? [],
            forms: forms.data ?? [],
            health: health.data ?? [],
            exportedAt: new Date().toISOString(),
        };
    }
    async anonymize(tenantId, recordId) {
        const supabase = this.supabase;
        await supabase.from("patient_records").update({
            patient_user_id: null,
            date_of_birth: null,
            emergency_contact: null,
            insurance_info: null,
            status: "archived",
        }).eq("tenant_id", tenantId).eq("id", recordId);
        return { success: true };
    }
};
exports.MedGdprService = MedGdprService;
exports.MedGdprService = MedGdprService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MedGdprService);
//# sourceMappingURL=med-gdpr.service.js.map