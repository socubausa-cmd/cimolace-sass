import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MedFormsService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async findAll(tenantId: string) {
    const { data } = await this.supabase.from("medical_forms").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return data ?? [];
  }
  async findOne(tenantId: string, id: string) {
    const { data } = await this.supabase.from("medical_forms").select("*").eq("tenant_id", tenantId).eq("id", id).single();
    return data;
  }
  async create(tenantId: string, dto: any) {
    const { data } = await this.supabase.from("medical_forms").insert({ tenant_id: tenantId, ...dto }).select().single();
    return data;
  }
  async submitResponse(tenantId: string, formId: string, patientId: string, responses: any) {
    const { data } = await this.supabase.from("form_responses").insert({ tenant_id: tenantId, form_id: formId, patient_id: patientId, responses }).select().single();
    return data;
  }
  async getResponses(tenantId: string, formId: string) {
    const { data } = await this.supabase.from("form_responses").select("*").eq("tenant_id", tenantId).eq("form_id", formId);
    return data ?? [];
  }
}
