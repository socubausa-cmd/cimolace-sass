import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

const SOAP_PROMPT = `Tu es un assistant médical expert. À partir de la transcription d'une consultation, génère une note SOAP structurée en JSON: { subjective, objective, assessment, plan, summary }. N'invente rien.`;

@Injectable()
export class MedChartingService {
  constructor(private auth: AuthService) {}

  async transcribe(tenantId: string, audioUrl: string) {
    // Placeholder — en production: appel Deepgram API
    return { jobId: "job_" + Date.now(), status: "queued", audioUrl };
  }

  async generateNote(tenantId: string, transcript: string) {
    // Placeholder — en production: appel Claude API avec SOAP_PROMPT
    const draft = {
      subjective: "[À remplir par le praticien]",
      objective: "[À remplir par le praticien]",
      assessment: "[À remplir par le praticien]",
      plan: "[À remplir par le praticien]",
      summary: "Note en attente de validation IA.",
    };
    // Save draft to consultation_notes
    const supabase = this.auth.getClient();
    const { data } = await supabase.from("consultation_notes").insert({
      tenant_id: tenantId,
      ai_transcript: transcript,
      ai_draft: JSON.stringify(draft),
    }).select().single();
    return data;
  }

  async regenerate(tenantId: string, noteId: string) {
    const supabase = this.auth.getClient();
    const { data: note } = await supabase.from("consultation_notes").select("ai_transcript").eq("tenant_id", tenantId).eq("id", noteId).single();
    if (!note?.ai_transcript) throw new Error("No transcript available");
    return this.generateNote(tenantId, note.ai_transcript);
  }
}
