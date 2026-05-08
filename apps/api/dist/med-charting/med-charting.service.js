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
exports.MedChartingService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const SOAP_PROMPT = `Tu es un assistant médical expert. À partir de la transcription d'une consultation, génère une note SOAP structurée en JSON: { subjective, objective, assessment, plan, summary }. N'invente rien.`;
let MedChartingService = class MedChartingService {
    constructor(auth) {
        this.auth = auth;
    }
    async transcribe(tenantId, audioUrl) {
        return { jobId: "job_" + Date.now(), status: "queued", audioUrl };
    }
    async generateNote(tenantId, transcript) {
        const draft = {
            subjective: "[À remplir par le praticien]",
            objective: "[À remplir par le praticien]",
            assessment: "[À remplir par le praticien]",
            plan: "[À remplir par le praticien]",
            summary: "Note en attente de validation IA.",
        };
        const supabase = this.auth.getClient();
        const { data } = await supabase.from("consultation_notes").insert({
            tenant_id: tenantId,
            ai_transcript: transcript,
            ai_draft: JSON.stringify(draft),
        }).select().single();
        return data;
    }
    async regenerate(tenantId, noteId) {
        const supabase = this.auth.getClient();
        const { data: note } = await supabase.from("consultation_notes").select("ai_transcript").eq("tenant_id", tenantId).eq("id", noteId).single();
        if (!note?.ai_transcript)
            throw new Error("No transcript available");
        return this.generateNote(tenantId, note.ai_transcript);
    }
};
exports.MedChartingService = MedChartingService;
exports.MedChartingService = MedChartingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MedChartingService);
//# sourceMappingURL=med-charting.service.js.map