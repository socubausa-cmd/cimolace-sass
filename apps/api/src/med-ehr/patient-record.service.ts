import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class PatientRecordService {
  constructor(private authService: AuthService) {}

  async create(tenantId: string, data: any) {
    const supabase = this.authService.getClient();
    const { data: record, error } = await supabase.from("patient_records").insert({ tenant_id: tenantId, ...data }).select().single();
    if (error) throw error;
    return record;
  }

  async findAll(tenantId: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("patient_records").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return data ?? [];
  }

  async findOne(tenantId: string, id: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("patient_records").select("*").eq("tenant_id", tenantId).eq("id", id).single();
    if (!data) throw new NotFoundException("Patient not found");
    return data;
  }

  async update(tenantId: string, id: string, updates: any) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("patient_records").update(updates).eq("tenant_id", tenantId).eq("id", id).select().single();
    if (!data) throw new NotFoundException("Patient not found");
    return data;
  }
}
