import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { AssignTeacherDto, CreateDocumentDto, ProcessEnrollmentDto, UpdateWorkflowStepDto } from './dto/secretariat.dto';

@Injectable()
export class SecretariatService {
  private readonly logger = new Logger(SecretariatService.name);
  constructor(private readonly supabase: SupabaseService) {}

  // ── Enrollments ──────────────────────────────────────────────────────────

  async listEnrollments(tenantId: string, status?: string) {
    let q = (this.supabase.client as any).from('enrollments').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return data ?? [];
  }

  async processEnrollment(tenantId: string, enrollmentId: string, userId: string, dto: ProcessEnrollmentDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('enrollments')
      .update({ status: dto.action, processed_by: userId, processed_at: new Date().toISOString(), notes: dto.notes ?? '' })
      .eq('id', enrollmentId).eq('tenant_id', tenantId).select('*').single();
    if (error || !data) throw new NotFoundException('Inscription introuvable');
    return data;
  }

  // ── Teacher Assignment ───────────────────────────────────────────────────

  async assignTeacher(tenantId: string, dto: AssignTeacherDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('teacher_assignments')
      .upsert({ tenant_id: tenantId, teacher_id: dto.teacherId, student_id: dto.studentId, course_id: dto.courseId ?? null }, { onConflict: 'tenant_id,student_id' })
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listTeacherAssignments(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('teacher_assignments').select('*').eq('tenant_id', tenantId);
    return data ?? [];
  }

  // ── Documents ────────────────────────────────────────────────────────────

  async createDocument(tenantId: string, userId: string, dto: CreateDocumentDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('secretariat_documents').insert({ tenant_id: tenantId, created_by: userId, title: dto.title, type: dto.type, content: dto.content ?? '' })
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listDocuments(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('secretariat_documents').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  // ── Workflow ─────────────────────────────────────────────────────────────

  async listWorkflowSteps(tenantId: string, entityType?: string, entityId?: string) {
    let q = (this.supabase.client as any).from('secretariat_workflow').select('*').eq('tenant_id', tenantId);
    if (entityType) q = q.eq('entity_type', entityType);
    if (entityId) q = q.eq('entity_id', entityId);
    const { data } = await q.order('step_order', { ascending: true });
    return data ?? [];
  }

  async updateWorkflowStep(tenantId: string, stepId: string, userId: string, dto: UpdateWorkflowStepDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('secretariat_workflow').update({ status: dto.status, notes: dto.notes, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', stepId).eq('tenant_id', tenantId).select('*').single();
    if (error || !data) throw new NotFoundException('Étape introuvable');
    return data;
  }
}
