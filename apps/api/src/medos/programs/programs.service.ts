import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateProgramDto,
  CreateStepDto,
  EnrollPatientDto,
  UpdateEnrollmentDto,
  UpdateProgramDto,
} from './dto/programs.dto';

@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Programs ────────────────────────────────────────────────────────────

  async create(
    tenant: TenantContext,
    actorId: string,
    dto: CreateProgramDto,
  ) {
    const { data, error } = await (this.supabase.client as any)
      .from('med_programs')
      .insert({
        tenant_id: tenant.id,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? 'custom',
        duration_days: dto.duration_days ?? null,
        is_template: dto.is_template ?? false,
        created_by: actorId,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createProgram', error?.message);
      throw new InternalServerErrorException('Création du programme impossible');
    }
    return data;
  }

  async list(tenant: TenantContext, category?: string) {
    let q = this.supabase.client
      .from('med_programs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);
    if (category) q = q.eq('category', category);
    const { data, error } = await q.order('title', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async get(tenant: TenantContext, programId: string) {
    const { data, error } = await this.supabase.client
      .from('med_programs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', programId)
      .single();
    if (error || !data) throw new NotFoundException('Programme introuvable');

    const steps = await this.listSteps(tenant, programId);
    return { ...(data as Record<string, unknown>), steps };
  }

  async update(
    tenant: TenantContext,
    programId: string,
    dto: UpdateProgramDto,
  ) {
    const patch: Record<string, unknown> = {};
    (['title', 'description', 'category', 'duration_days', 'is_active'] as const).forEach(
      (k) => {
        if (dto[k] !== undefined) patch[k] = dto[k];
      },
    );
    if (Object.keys(patch).length === 0) return this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_programs')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', programId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Programme introuvable');
    return data;
  }

  // ─── Steps ───────────────────────────────────────────────────────────────

  async addStep(
    tenant: TenantContext,
    programId: string,
    dto: CreateStepDto,
  ) {
    // S'assurer que le programme existe
    await this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_program_steps')
      .insert({
        tenant_id: tenant.id,
        program_id: programId,
        position: dto.position ?? 0,
        title: dto.title,
        description: dto.description ?? null,
        step_type: dto.step_type ?? 'task',
        due_after_days: dto.due_after_days ?? 0,
        linked_form_id: dto.linked_form_id ?? null,
        content_md: dto.content_md ?? null,
        is_required: dto.is_required ?? true,
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException("Ajout de l'étape impossible");
    }
    return data;
  }

  async listSteps(tenant: TenantContext, programId: string) {
    const { data, error } = await this.supabase.client
      .from('med_program_steps')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('program_id', programId)
      .order('position', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async removeStep(tenant: TenantContext, programId: string, stepId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('med_program_steps')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('program_id', programId)
      .eq('id', stepId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Étape introuvable');
    return { id: (data as any).id };
  }

  // ─── Enrollments ─────────────────────────────────────────────────────────

  async enroll(
    tenant: TenantContext,
    actorId: string,
    programId: string,
    dto: EnrollPatientDto,
  ) {
    // Vérifier patient + programme
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (!patient) throw new NotFoundException('Patient introuvable');
    await this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_program_enrollments')
      .insert({
        tenant_id: tenant.id,
        program_id: programId,
        patient_id: dto.patient_id,
        enrolled_by: actorId,
        notes: dto.notes ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException('Patient déjà inscrit à ce programme');
      }
      throw new InternalServerErrorException("Inscription impossible");
    }
    return data;
  }

  async listEnrollments(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    filters: { patient_id?: string; status?: string } = {},
  ) {
    let q = this.supabase.client
      .from('med_program_enrollments')
      .select('*')
      .eq('tenant_id', tenant.id);

    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_user_id', actorId)
        .maybeSingle();
      if (!pat) return [];
      q = q.eq('patient_id', (pat as any).id);
    } else if (filters.patient_id) {
      q = q.eq('patient_id', filters.patient_id);
    }
    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q.order('enrolled_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async updateEnrollment(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ) {
    // Patient peut UPDATE son propre progress (current_step_position, status='abandoned')
    if (actorRole === 'patient') {
      const { data: enr } = await this.supabase.client
        .from('med_program_enrollments')
        .select('*, patient:med_patients!inner(patient_user_id)')
        .eq('id', enrollmentId)
        .single();
      if (
        !enr ||
        ((enr as any).patient as any)?.patient_user_id !== actorId
      ) {
        throw new ForbiddenException("Accès refusé à cette inscription");
      }
      // Restreindre les champs modifiables par le patient
      const allowed = ['current_step_position', 'progress_percent'];
      const patientPatch: Record<string, unknown> = {};
      allowed.forEach((k) => {
        if ((dto as any)[k] !== undefined) patientPatch[k] = (dto as any)[k];
      });
      if (dto.status === 'abandoned') patientPatch.status = 'abandoned';

      if (Object.keys(patientPatch).length === 0) return enr;
      const { data, error } = await (this.supabase.client as any)
        .from('med_program_enrollments')
        .update(patientPatch)
        .eq('id', enrollmentId)
        .select('*')
        .single();
      if (error || !data)
        throw new InternalServerErrorException('Mise à jour impossible');
      return data;
    }

    // Staff : tout est permis
    const patch: Record<string, unknown> = {};
    (
      ['status', 'current_step_position', 'progress_percent', 'notes'] as const
    ).forEach((k) => {
      if (dto[k] !== undefined) patch[k] = dto[k];
    });
    if (dto.status === 'completed') {
      patch.completed_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      const { data } = await this.supabase.client
        .from('med_program_enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .single();
      return data;
    }
    const { data, error } = await (this.supabase.client as any)
      .from('med_program_enrollments')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', enrollmentId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Inscription introuvable');
    return data;
  }
}
