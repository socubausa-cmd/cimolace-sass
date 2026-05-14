import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateCourseDto, CreateLessonDto, CreateModuleDto, UpdateProgressDto } from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly supabase: SupabaseService) {}

  async createCourse(tenant: TenantContext, userId: string, dto: CreateCourseDto) {
    const { data, error } = await (this.supabase.client as any).from('courses').insert({
      tenant_id: tenant.id, created_by: userId, title: dto.title,
      description: dto.description ?? '', category: dto.category ?? 'general',
      price_cents: dto.priceCents ?? 0, status: 'draft',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listCourses(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('courses').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getCourse(tenantId: string, courseId: string) {
    const { data, error } = await (this.supabase.client as any).from('courses').select('*').eq('id', courseId).eq('tenant_id', tenantId).single();
    if (error || !data) throw new NotFoundException('Cours introuvable');
    return data;
  }

  async createModule(tenant: TenantContext, courseId: string, dto: CreateModuleDto) {
    await this.getCourse(tenant.id, courseId);
    const { data, error } = await (this.supabase.client as any).from('course_modules').insert({
      tenant_id: tenant.id, course_id: courseId, title: dto.title,
      description: dto.description ?? '', order_index: dto.orderIndex,
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listModules(tenantId: string, courseId: string) {
    const { data } = await (this.supabase.client as any).from('course_modules').select('*').eq('course_id', courseId).eq('tenant_id', tenantId).order('order_index');
    return data ?? [];
  }

  async createLesson(tenant: TenantContext, moduleId: string, dto: CreateLessonDto) {
    const { data, error } = await (this.supabase.client as any).from('course_lessons').insert({
      tenant_id: tenant.id, module_id: moduleId, title: dto.title,
      content: dto.content ?? '', video_url: dto.videoUrl ?? null, order_index: dto.orderIndex,
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listLessons(tenantId: string, moduleId: string) {
    const { data } = await (this.supabase.client as any).from('course_lessons').select('*').eq('module_id', moduleId).eq('tenant_id', tenantId).order('order_index');
    return data ?? [];
  }

  async updateProgress(tenantId: string, userId: string, lessonId: string, dto: UpdateProgressDto) {
    const { data, error } = await (this.supabase.client as any).from('student_progress').upsert({
      tenant_id: tenantId, user_id: userId, lesson_id: lessonId,
      status: dto.status, time_spent_seconds: dto.timeSpentSeconds ?? 0,
      completed_at: dto.status === 'completed' ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getProgress(tenantId: string, userId: string, courseId: string) {
    const { data } = await (this.supabase.client as any).from('student_progress').select('*').eq('tenant_id', tenantId).eq('user_id', userId).eq('course_id', courseId);
    return data ?? [];
  }
}
