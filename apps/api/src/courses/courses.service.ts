import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import { cycleCan, resolveMemberCycle } from '../billing/member-tier';
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

  async listCourses(tenantId: string, userRole?: string | null) {
    // Un élève ne voit QUE le publié : les brouillons restent réservés au staff
    // (fuite de contenu non publié sinon — le front badge « Bientôt » mais l'API est la barrière).
    const STAFF = ['owner', 'admin', 'teacher', 'creator', 'secretariat'];
    const isStaff = STAFF.includes(String(userRole ?? '').toLowerCase());
    let q = (this.supabase.client as any).from('courses').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (!isStaff) q = q.eq('status', 'published');
    const { data } = await q;
    return data ?? [];
  }

  async getCourse(tenantId: string, courseId: string) {
    const { data, error } = await (this.supabase.client as any).from('courses').select('*').eq('id', courseId).eq('tenant_id', tenantId).single();
    if (error || !data) throw new NotFoundException('Cours introuvable');
    return data;
  }

  async updateCourse(tenantId: string, courseId: string, updates: Record<string, any>) {
    // Whitelist des colonnes modifiables (n'altère pas tenant_id/id/created_by ; évite les colonnes inexistantes).
    const allowed = ['title', 'description', 'category', 'price_cents', 'status'];
    const patch: Record<string, any> = {};
    for (const k of allowed) if (updates?.[k] !== undefined) patch[k] = updates[k];
    if (Object.keys(patch).length === 0) return this.getCourse(tenantId, courseId);
    const { data, error } = await (this.supabase.client as any)
      .from('courses').update(patch).eq('id', courseId).eq('tenant_id', tenantId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Cours introuvable');
    return data;
  }

  async deleteCourse(tenantId: string, courseId: string) {
    const { error } = await (this.supabase.client as any)
      .from('courses').delete().eq('id', courseId).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
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
    // student_progress.course_id est NOT NULL → on le résout depuis la leçon
    // (leçon → module → cours), tenant-scopé. Sans ça, l'upsert 400 systématiquement.
    const client = this.supabase.client as any;
    const { data: lesson } = await client.from('course_lessons')
      .select('module_id').eq('id', lessonId).eq('tenant_id', tenantId).maybeSingle();
    if (!lesson?.module_id) throw new NotFoundException('Leçon introuvable');
    const { data: mod } = await client.from('course_modules')
      .select('course_id').eq('id', lesson.module_id).eq('tenant_id', tenantId).maybeSingle();
    if (!mod?.course_id) throw new NotFoundException('Module introuvable pour cette leçon');

    const { data, error } = await client.from('student_progress').upsert({
      tenant_id: tenantId, user_id: userId, lesson_id: lessonId, course_id: mod.course_id,
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

  /**
   * Signe CÔTÉ SERVEUR l'URL d'une vidéo de cours hébergée (bucket `videos`), APRÈS enforcement.
   *
   * Ferme le trou : le lecteur signait l'URL directement via une RLS storage trop permissive
   * (`videos` lisible par tout authentifié) → un lien partagé / un mauvais palier passait.
   * Ici, le serveur (identifié + authentifié via JwtAuthGuard/TenantGuard) :
   *   1. vérifie que le COURS existe DANS le tenant (ancre du gating) ;
   *   2. lit le storagePath DEPUIS la DB (jamais depuis le client) et vérifie que le contenu
   *      appartient bien à ce cours (anti-forge : pas de cours gratuit + chemin premium) ;
   *   3. gate par mode d'accès (staff bypass ; subscription → forfait actif requis ;
   *      one_time → inscription requise ; free → membre tenant suffit) ;
   *   4. ne signe qu'ensuite.
   */
  async signCourseVideoUrl(tenant: TenantContext, userId: string, courseId: string, contentId: string) {
    const client = this.supabase.client as any;
    if (!courseId) throw new BadRequestException('courseId requis');
    if (!contentId) throw new BadRequestException('contentId requis');

    // 1. Le cours existe-t-il DANS ce tenant ?
    const { data: course } = await client
      .from('courses')
      .select('id, status, meta, price_cents')
      .eq('id', courseId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!course) throw new NotFoundException('Cours introuvable');

    // 2. Charger le contenu ; storagePath vient de la DB, pas du client.
    const { data: content } = await client
      .from('formation_day_contents')
      .select('id, day_id, data')
      .eq('id', contentId)
      .maybeSingle();
    if (!content) throw new NotFoundException('Contenu introuvable');

    const storagePath = String(content?.data?.storagePath || '');
    if (!storagePath) {
      throw new BadRequestException("Ce contenu n'a pas de vidéo hébergée à signer.");
    }

    // Anti-forge : le contenu remonte-t-il bien jusqu'à CE cours ?
    const belongs = await this.contentBelongsToCourse(client, content.day_id, courseId);
    if (!belongs) throw new ForbiddenException("Ce contenu ne fait pas partie de ce cours.");

    // 3. Gating d'accès.
    const STAFF = ['owner', 'admin', 'teacher', 'creator', 'secretariat'];
    const isStaff = STAFF.includes(String(tenant.userRole || '').toLowerCase());
    if (!isStaff) {
      // Membre du tenant EXIGÉ : TenantGuard peut poser userRole=null pour un non-membre
      // (resolveTenant fail-open) → sans ce garde, un non-membre obtiendrait une vidéo de
      // cours gratuite via l'API (service_role bypasse la RLS can_sign_course_video).
      if (!tenant.userRole) {
        throw new ForbiddenException('Accès réservé aux membres inscrits de ce tenant.');
      }
      const meta = course?.meta && typeof course.meta === 'object' ? (course.meta as Record<string, any>) : {};
      // Défaut : payant (one_time) si le cours a un prix, sinon gratuit — pour qu'un cours
      // payant sans meta.access_mode explicite ne soit pas servi sans inscription.
      const accessMode =
        meta.access_mode || meta?.access?.mode || (Number(course.price_cents) > 0 ? 'one_time' : 'free');

      if (accessMode === 'subscription') {
        const cycle = await resolveMemberCycle(client, tenant.id, userId);
        if (!cycleCan(cycle, 'coursReplay')) {
          throw new ForbiddenException('Un forfait actif est requis pour visionner ce cours.');
        }
      } else if (accessMode === 'one_time') {
        const { data: enroll } = await client
          .from('student_progress')
          .select('id')
          .eq('course_id', courseId)
          .eq('user_id', userId)
          .in('status', ['active', 'approved', 'paid'])
          .limit(1);
        if (!Array.isArray(enroll) || enroll.length === 0) {
          throw new ForbiddenException('Ce cours est en vente individuelle : achat requis pour y accéder.');
        }
      }
      // 'free' → membre tenant authentifié suffit.
    }

    // 4. Signer côté serveur (URL fraîche 1h).
    const { data: signed, error } = await client.storage.from('videos').createSignedUrl(storagePath, 3600);
    if (error || !signed?.signedUrl) {
      throw new BadRequestException('Signature de la vidéo impossible.');
    }
    return { url: signed.signedUrl };
  }

  /** Remonte contenu → jour → semaine → module → cours ; true si le contenu appartient à courseId. */
  private async contentBelongsToCourse(client: any, dayId: string | null, courseId: string): Promise<boolean> {
    if (!dayId) return false;
    const { data: day } = await client.from('formation_days').select('week_id').eq('id', dayId).maybeSingle();
    if (!day?.week_id) return false;
    const { data: week } = await client.from('formation_weeks').select('module_id').eq('id', day.week_id).maybeSingle();
    if (!week?.module_id) return false;
    const { data: mod } = await client.from('modules').select('formation_id').eq('id', week.module_id).maybeSingle();
    return String(mod?.formation_id || '') === String(courseId);
  }
}
