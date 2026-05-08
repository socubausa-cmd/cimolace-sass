import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class ConsultationNoteService {
  constructor(private authService: AuthService) {}

  async create(tenantId: string, data: any) {
    const supabase = this.authService.getClient();
    const { data: note } = await supabase.from("consultation_notes").insert({ tenant_id: tenantId, ...data }).select().single();
    return note;
  }

  async findByRecord(tenantId: string, recordId: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("consultation_notes").select("*").eq("tenant_id", tenantId).eq("record_id", recordId).order("created_at", { ascending: false });
    return data ?? [];
  }

  async findOne(tenantId: string, id: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("consultation_notes").select("*").eq("tenant_id", tenantId).eq("id", id).single();
    if (!data) throw new NotFoundException("Note not found");
    return data;
  }

  async update(tenantId: string, id: string, updates: any) {
    const supabase = this.authService.getClient();
    const { data: note } = await supabase.from("consultation_notes").select("is_signed").eq("tenant_id", tenantId).eq("id", id).single();
    if (!note) throw new NotFoundException("Note not found");
    if (note.is_signed) throw new Error("Cannot edit a signed note");
    const { data } = await supabase.from("consultation_notes").update(updates).eq("tenant_id", tenantId).eq("id", id).select().single();
    return data;
  }

  async sign(tenantId: string, id: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("consultation_notes").update({ is_signed: true, signed_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id).select().single();
    return data;
  }

  async share(tenantId: string, id: string, shared: boolean) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("consultation_notes").update({ is_shared_with_patient: shared }).eq("tenant_id", tenantId).eq("id", id).select().single();
    return data;
  }
}
