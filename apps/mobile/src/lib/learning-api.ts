import { API_BASE, currentToken, TENANT_SLUG, type Course, type CourseLesson, type CourseModule } from '@/lib/liri-api';

export interface LessonProgress {
  lesson_id: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  time_spent_seconds?: number;
  completed_at?: string | null;
}

export interface CourseCurriculum {
  course: Course;
  modules: (CourseModule & { lessons: CourseLesson[] })[];
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

export async function fetchCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  const [course, modules, progress] = await Promise.all([
    readJson<Course>(`/courses/${encodeURIComponent(courseId)}`),
    readJson<CourseModule[]>(`/courses/${encodeURIComponent(courseId)}/modules`),
    readJson<LessonProgress[]>(`/courses/${encodeURIComponent(courseId)}/progress`).catch(() => []),
  ]);
  const hydrated = await Promise.all(
    modules.map(async (module) => ({
      ...module,
      lessons: await readJson<CourseLesson[]>(
        `/courses/modules/${encodeURIComponent(module.id)}/lessons`,
      ),
    })),
  );
  return { course, modules: hydrated, progress };
}
