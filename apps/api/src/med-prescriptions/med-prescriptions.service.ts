import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MedPrescriptionsService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async create(tenantId: string, data: any) {
    const { data: rx } = await this.supabase.from("prescriptions").insert({ tenant_id: tenantId, ...data }).select().single();
    return rx;
  }
  async findByRecord(tenantId: string, recordId: string) {
    const { data } = await this.supabase.from("prescriptions").select("*").eq("tenant_id", tenantId).eq("record_id", recordId).order("created_at", { ascending: false });
    return data ?? [];
  }
  async sign(tenantId: string, id: string) {
    const { data } = await this.supabase.from("prescriptions").update({ is_signed: true, signed_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id).select().single();
    return data;
  }
}
