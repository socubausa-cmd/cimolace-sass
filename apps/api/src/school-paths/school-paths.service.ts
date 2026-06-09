import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SchoolPathsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return (this.supabase.client as any); }

  // ── School Paths ─────────────────────────────────────────────────────────────

  async listPaths(userId: string) {
    const { data } = await this.db.from('school_paths').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getPathTree(pathId: string, userId: string) {
    const { data, error } = await this.db
      .from('school_paths')
      .select(`
        *,
        path_courses (
          *,
          course_modules (
            *,
            module_weeks (
              *,
              week_days (
                *,
                pedagogical_blocks (*)
              )
            )
          )
        )
      `)
      .eq('id', pathId)
      .eq('owner_id', userId)
      .single();
    if (error || !data) throw new NotFoundException('Parcours introuvable');
    return data;
  }

  async createPath(userId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('school_paths').insert({ owner_id: userId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePath(pathId: string, userId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('school_paths').update(dto).eq('id', pathId).eq('owner_id', userId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deletePath(pathId: string, userId: string) {
    const { error } = await this.db.from('school_paths').delete().eq('id', pathId).eq('owner_id', userId);
    if (error) throw new BadRequestException(error.message);
  }

  // ── Courses ──────────────────────────────────────────────────────────────────

  async listCourses(pathId: string) {
    const { data } = await this.db.from('path_courses').select('*').eq('path_id', pathId).order('sort_order', { ascending: true });
    return data ?? [];
  }

  async createCourse(pathId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('path_courses').insert({ path_id: pathId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCourse(courseId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('path_courses').update(dto).eq('id', courseId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteCourse(courseId: string) {
    const { error } = await this.db.from('path_courses').delete().eq('id', courseId);
    if (error) throw new BadRequestException(error.message);
  }

  // ── Modules ──────────────────────────────────────────────────────────────────

  async listModules(courseId: string) {
    const { data } = await this.db.from('course_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
    return data ?? [];
  }

  async createModule(courseId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('course_modules').insert({ course_id: courseId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ── Weeks ────────────────────────────────────────────────────────────────────

  async listWeeks(moduleId: string) {
    const { data } = await this.db.from('module_weeks').select('*').eq('module_id', moduleId).order('week_number', { ascending: true });
    return data ?? [];
  }

  async createWeek(moduleId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('module_weeks').insert({ module_id: moduleId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateWeek(weekId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('module_weeks').update(dto).eq('id', weekId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteWeek(weekId: string) {
    const { error } = await this.db.from('module_weeks').delete().eq('id', weekId);
    if (error) throw new BadRequestException(error.message);
  }

  // ── Days ─────────────────────────────────────────────────────────────────────

  async listDays(weekId: string) {
    const { data } = await this.db
      .from('week_days')
      .select('*, pedagogical_blocks(*)')
      .eq('week_id', weekId)
      .order('day_number', { ascending: true });
    return data ?? [];
  }

  async createDay(weekId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('week_days').insert({ week_id: weekId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDay(dayId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('week_days').update(dto).eq('id', dayId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteDay(dayId: string) {
    const { error } = await this.db.from('week_days').delete().eq('id', dayId);
    if (error) throw new BadRequestException(error.message);
  }

  // ── Blocks ───────────────────────────────────────────────────────────────────

  async listBlocks(dayId: string) {
    const { data } = await this.db.from('pedagogical_blocks').select('*').eq('day_id', dayId).order('sort_order', { ascending: true });
    return data ?? [];
  }

  async createBlock(dayId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('pedagogical_blocks').insert({ day_id: dayId, ...dto }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateBlock(blockId: string, dto: Record<string, any>) {
    const { data, error } = await this.db.from('pedagogical_blocks').update(dto).eq('id', blockId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteBlock(blockId: string) {
    const { error } = await this.db.from('pedagogical_blocks').delete().eq('id', blockId);
    if (error) throw new BadRequestException(error.message);
  }

  // ── Grammar ──────────────────────────────────────────────────────────────────

  async applyGrammar(weekId: string, grammarKey: string) {
    if (grammarKey !== 'standard_5j') {
      throw new BadRequestException(`Grammaire inconnue : ${grammarKey}`);
    }

    // standard_5j : 5 jours, chacun avec structure type ouverture → contenu → synthèse
    const dayTemplates = [
      { day_number: 1, pedagogy_type: 'introduction', title: 'Ouverture — Mise en contexte', sort_order: 1 },
      { day_number: 2, pedagogy_type: 'theory',       title: 'Apport théorique',             sort_order: 2 },
      { day_number: 3, pedagogy_type: 'practice',     title: 'Mise en pratique',              sort_order: 3 },
      { day_number: 4, pedagogy_type: 'application',  title: 'Application & exercices',       sort_order: 4 },
      { day_number: 5, pedagogy_type: 'synthesis',    title: 'Synthèse & évaluation',         sort_order: 5 },
    ];

    const blockTemplatesByDay: Record<number, { type: string; title: string; sort_order: number }[]> = {
      1: [
        { type: 'text',  title: 'Introduction',        sort_order: 1 },
        { type: 'video', title: 'Vidéo de présentation', sort_order: 2 },
        { type: 'quiz',  title: 'Quiz d\'amorce',        sort_order: 3 },
      ],
      2: [
        { type: 'text',  title: 'Contenu théorique',   sort_order: 1 },
        { type: 'file',  title: 'Support PDF',         sort_order: 2 },
        { type: 'quiz',  title: 'Quiz de compréhension', sort_order: 3 },
      ],
      3: [
        { type: 'text',    title: 'Consignes',         sort_order: 1 },
        { type: 'exercise', title: 'Exercice guidé',   sort_order: 2 },
        { type: 'text',    title: 'Corrigé type',      sort_order: 3 },
      ],
      4: [
        { type: 'exercise', title: 'Exercice autonome', sort_order: 1 },
        { type: 'file',     title: 'Ressources complémentaires', sort_order: 2 },
        { type: 'quiz',     title: 'Auto-évaluation',   sort_order: 3 },
      ],
      5: [
        { type: 'text',  title: 'Points clés',         sort_order: 1 },
        { type: 'quiz',  title: 'Évaluation finale',   sort_order: 2 },
        { type: 'text',  title: 'Pour aller plus loin', sort_order: 3 },
      ],
    };

    const createdDays: any[] = [];

    for (const dayTpl of dayTemplates) {
      const { data: day, error: dayErr } = await this.db
        .from('week_days')
        .insert({ week_id: weekId, ...dayTpl })
        .select('*')
        .single();
      if (dayErr) throw new BadRequestException(`Erreur création jour ${dayTpl.day_number}: ${dayErr.message}`);

      const blockRows = (blockTemplatesByDay[dayTpl.day_number] ?? []).map(b => ({ day_id: day.id, data: {}, ...b }));
      if (blockRows.length > 0) {
        const { error: blockErr } = await this.db.from('pedagogical_blocks').insert(blockRows);
        if (blockErr) throw new BadRequestException(`Erreur création blocs jour ${dayTpl.day_number}: ${blockErr.message}`);
      }

      createdDays.push(day);
    }

    return { weekId, grammarKey, daysCreated: createdDays.length };
  }

  // ── Student assignment ────────────────────────────────────────────────────────

  async assignPathToStudent(studentId: string, pathId: string | null) {
    const { data: profile } = await this.supabase.client
      .from("profiles")
      .select("metadata")
      .eq("id", studentId)
      .single();
    const existing = (profile as any)?.metadata || {};
    await (this.supabase.client as any)
      .from("profiles")
      .update({ metadata: { ...existing, school_path_id: pathId } })
      .eq("id", studentId);
    return { success: true };
  }

  async getStudentsByTenant(tenantId: string) {
    const { data } = await this.supabase.client
      .from("tenant_memberships")
      .select("user_id, profiles(id, full_name, email, metadata)")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .eq("status", "active");
    return (data || []).map((m: any) => ({
      ...m.profiles,
      school_path_id: m.profiles?.metadata?.school_path_id || null,
    }));
  }
}
