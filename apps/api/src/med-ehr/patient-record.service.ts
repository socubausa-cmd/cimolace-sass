import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class PatientRecordService {
  constructor(private authService: AuthService) {}

  async create(tenantId: string, data: any) {
    const supabase = this.authService.getClient();
    // patient_user_id is nullable now (draft dossier pre-invitation). If caller
    // doesn't provide one (most likely path from the doctor "+ Nouveau patient"
    // modal), we leave it NULL — invitation flow will set it later.
    const payload = {
      tenant_id: tenantId,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      gender: data.gender ?? null,
      blood_type: data.blood_type ?? null,
      allergies: data.allergies ?? [],
      patient_user_id: data.patient_user_id ?? null,
      status: data.status ?? "active",
    };
    const { data: record, error } = await supabase
      .from("patient_records")
      .insert(payload)
      .select()
      .single();
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
