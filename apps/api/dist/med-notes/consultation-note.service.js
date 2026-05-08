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
exports.ConsultationNoteService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
let ConsultationNoteService = class ConsultationNoteService {
    constructor(authService) {
        this.authService = authService;
    }
    async create(tenantId, data) {
        const supabase = this.authService.getClient();
        const { data: note } = await supabase.from("consultation_notes").insert({ tenant_id: tenantId, ...data }).select().single();
        return note;
    }
    async findByRecord(tenantId, recordId) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("consultation_notes").select("*").eq("tenant_id", tenantId).eq("record_id", recordId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async findOne(tenantId, id) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("consultation_notes").select("*").eq("tenant_id", tenantId).eq("id", id).single();
        if (!data)
            throw new common_1.NotFoundException("Note not found");
        return data;
    }
    async update(tenantId, id, updates) {
        const supabase = this.authService.getClient();
        const { data: note } = await supabase.from("consultation_notes").select("is_signed").eq("tenant_id", tenantId).eq("id", id).single();
        if (!note)
            throw new common_1.NotFoundException("Note not found");
        if (note.is_signed)
            throw new Error("Cannot edit a signed note");
        const { data } = await supabase.from("consultation_notes").update(updates).eq("tenant_id", tenantId).eq("id", id).select().single();
        return data;
    }
    async sign(tenantId, id) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("consultation_notes").update({ is_signed: true, signed_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id).select().single();
        return data;
    }
    async share(tenantId, id, shared) {
        const supabase = this.authService.getClient();
        const { data } = await supabase.from("consultation_notes").update({ is_shared_with_patient: shared }).eq("tenant_id", tenantId).eq("id", id).select().single();
        return data;
    }
};
exports.ConsultationNoteService = ConsultationNoteService;
exports.ConsultationNoteService = ConsultationNoteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], ConsultationNoteService);
//# sourceMappingURL=consultation-note.service.js.map