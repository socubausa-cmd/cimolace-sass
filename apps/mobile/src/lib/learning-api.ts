import { API_BASE, currentToken, TENANT_SLUG, type Course, type CourseLesson, type CourseModule } from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

export interface LessonProgress {
  lesson_id: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  time_spent_seconds?: number;
  completed_at?: string | null;
}

/** Leçon enrichie : porte le TYPE + les DONNÉES du content pour le lecteur natif. */
export interface CurriculumLesson extends CourseLesson {
  contentType?: 'video' | 'powerpoint' | 'quiz' | string;
  contentData?: Record<string, unknown>;
}

export interface CourseCurriculum {
  course: Course;
  modules: (CourseModule & { lessons: CurriculumLesson[] })[];
  progress: LessonProgress[];
}

async function readJson<T>(path: string): Promise<T> {
  const token = currentToken();
  if (!token) throw new Error('Connecte-toi pour consulter tes formations.');

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
    },
  });
  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // La réponse API peut être vide.
    }
    throw new Error(message);
  }
  const json = (await response.json()) as { data?: T } | T;
  return ((json as { data?: T }).data ?? json) as T;
}

export async function fetchStudentCourses(): Promise<Course[]> {
  const courses = await readJson<Course[]>('/courses');
  const published = courses.filter((course) => course.status === 'published');
  // Certains tenants historiques n'ont pas encore de statut renseigné.
  return published.length > 0 ? published : courses.filter((course) => course.status !== 'archived');
}

type OutlineModule = CourseModule & { lessons: CurriculumLesson[] };

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Lit la structure RELATIONNELLE réelle d'un cours (modules → formation_weeks → formation_days →
 * formation_day_contents) — la MÊME source que le portail web (`useFormationStructure`) et que les
 * constructeurs écrivent réellement (`saveStructure`). Aplatie en modules→leçons (1 content = 1
 * leçon), la forme que l'écran natif rend déjà.
 *
 * ⚠️ Avant : l'écran lisait `/courses/:id/modules` + `/courses/modules/:id/lessons` (NestJS →
 * `course_modules`/`course_lessons`), tables MORTES qu'aucun builder ne remplit → programme VIDE
 * pour tout cours créé au studio. On lit désormais les bonnes tables via Supabase (RLS tenant).
 */
async function fetchFormationOutline(courseId: string): Promise<OutlineModule[]> {
  const { data, error } = await supabase
    .from('modules')
    .select(
      `id, title, description, sort_order,
       formation_weeks ( id, sort_order,
         formation_days ( id, sort_order,
           formation_day_contents ( id, type, sort_order, data ) ) )`,
    )
    .eq('formation_id', courseId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .slice()
    .sort((a: any, b: any) => num(a.sort_order) - num(b.sort_order))
    .map((m: any, mi: number): OutlineModule => {
      const lessons: CurriculumLesson[] = [];
      (m.formation_weeks ?? [])
        .slice()
        .sort((a: any, b: any) => num(a.sort_order) - num(b.sort_order))
        .forEach((w: any) =>
          (w.formation_days ?? [])
            .slice()
            .sort((a: any, b: any) => num(a.sort_order) - num(b.sort_order))
            .forEach((d: any) =>
              (d.formation_day_contents ?? [])
                .slice()
                .sort((a: any, b: any) => num(a.sort_order) - num(b.sort_order))
                .forEach((c: any) => {
                  const cd = (c.data ?? {}) as Record<string, unknown>;
                  const label = String(
                    cd.title || cd.name || (c.type === 'video' ? 'Vidéo' : c.type || 'Contenu'),
                  ).trim();
                  lessons.push({
                    id: String(c.id),
                    title: label,
                    // sentinelle truthy : l'écran affiche l'icône ▷ pour une vidéo (le player résout l'URL réelle).
                    video_url: c.type === 'video' ? '1' : undefined,
                    contentType: String(c.type || ''),
                    contentData: cd,
                  });
                }),
            ),
        );
      return { id: String(m.id), title: m.title, description: m.description, order_index: num(m.sort_order) || mi, lessons };
    });
}

export async function fetchCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  const [course, outline, progress] = await Promise.all([
    readJson<Course>(`/courses/${encodeURIComponent(courseId)}`),
    fetchFormationOutline(courseId).catch(() => [] as OutlineModule[]),
    readJson<LessonProgress[]>(`/courses/${encodeURIComponent(courseId)}/progress`).catch(() => []),
  ]);

  let modules: OutlineModule[] = outline;
  // Repli LEGACY : cours anciens sans structure relationnelle (course_modules/course_lessons via NestJS).
  if (modules.length === 0) {
    try {
      const legacy = await readJson<CourseModule[]>(`/courses/${encodeURIComponent(courseId)}/modules`);
      modules = await Promise.all(
        legacy.map(async (module) => ({
          ...module,
          lessons: await readJson<CourseLesson[]>(
            `/courses/modules/${encodeURIComponent(module.id)}/lessons`,
          ).catch(() => [] as CourseLesson[]),
        })),
      );
    } catch {
      modules = [];
    }
  }

  return { course, modules, progress };
}
