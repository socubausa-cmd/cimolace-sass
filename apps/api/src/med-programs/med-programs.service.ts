import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MedProgramsService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async findAll(tenantId: string) {
    const { data } = await this.supabase.from("care_programs").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
  async create(tenantId: string, dto: any) {
    const { data } = await this.supabase.from("care_programs").insert({ tenant_id: tenantId, ...dto }).select().single();
    return data;
  }
  async addStep(programId: string, step: any) {
    const { data } = await this.supabase.from("care_program_steps").insert({ program_id: programId, ...step }).select().single();
    return data;
  }
  async assign(tenantId: string, programId: string, patientId: string, recordId: string) {
    const { data } = await this.supabase.from("patient_programs").insert({ tenant_id: tenantId, program_id: programId, patient_id: patientId, record_id: recordId, start_date: new Date().toISOString().split("T")[0] }).select().single();
    return data;
  }
  async findByPatient(tenantId: string, patientId: string) {
    const { data } = await this.supabase.from("patient_programs").select("*, care_programs(*)").eq("tenant_id", tenantId).eq("patient_id", patientId);
    return data ?? [];
  }
}
