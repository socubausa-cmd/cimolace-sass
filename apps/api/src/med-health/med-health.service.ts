import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MedHealthService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async create(tenantId: string, data: any) {
    const { data: entry } = await this.supabase.from("health_entries").insert({ tenant_id: tenantId, ...data }).select().single();
    return entry;
  }
  async findByPatient(tenantId: string, patientUserId: string) {
    const { data } = await this.supabase.from("health_entries").select("*").eq("tenant_id", tenantId).eq("patient_user_id", patientUserId).order("entry_date", { ascending: false });
    return data ?? [];
  }
}
