import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MedGdprService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async exportPatientData(tenantId: string, recordId: string) {
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

  async anonymize(tenantId: string, recordId: string) {
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
}
