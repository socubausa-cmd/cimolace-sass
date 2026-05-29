/**
 * TenantCourseDetailPage — /t/:tenantSlug/admin/courses/:courseId
 * Vue détail d'un cours : modules + leçons + player intégré.
 * Utilisé aussi depuis /student-school-life/formations/:courseId via redirect.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';

const BTN_PRIMARY = 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const BTN_GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';

// ── Lecteur leçon ─────────────────────────────────────────────────────────────
function LessonPlayer({ lesson, onComplete, onClose }) {
  const [marking, setMarking] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function markDone() {
    setMarking(true);
    try {
      await coursesApi.updateProgress(lesson.id, { status: 'completed' });
      setCompleted(true);
      onComplete?.(lesson.id);
    } catch { /* silent */ }
    finally { setMarking(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <h2 className="text-sm font-medium text-white">{lesson.title}</h2>
        <button
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${completed ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
          onClick={markDone}
          disabled={marking || completed}
        >
          {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : completed ? '✓ Terminé' : 'Marquer terminé'}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video / Content */}
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          {lesson.video_url ? (
            <video
              className="max-h-full max-w-full rounded-xl"
              src={lesson.video_url}
              controls
              autoPlay
            />
          ) : lesson.content ? (
            <div
              className="max-w-2xl rounded-xl bg-white/5 p-8 text-gray-100 prose prose-invert"
              dangerouslySetInnerHTML={{ __html: lesson.content }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <BookOpen className="h-12 w-12" />
              <p>Aucun contenu disponible pour cette leçon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function TenantCourseDetailPage() {
  const { tenantSlug, courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState({}); // { [moduleId]: lesson[] }
  const [progress, setProgress] = useState([]); // lesson progress records
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [activeLesson, setActiveLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [courseId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [c, mods, prog] = await Promise.all([
        coursesApi.get(courseId),
        coursesApi.listModules(courseId),
        coursesApi.getProgress(courseId).catch(() => []),
      ]);
      setCourse(c);
      const sortedMods = (mods ?? []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setModules(sortedMods);
      setProgress(Array.isArray(prog) ? prog : []);
      // Expand first module by default
      if (sortedMods.length > 0) {
        setExpandedModules(new Set([sortedMods[0].id]));
        const firstLessons = await coursesApi.listLessons(sortedMods[0].id).catch(() => []);
        setLessons({ [sortedMods[0].id]: (firstLessons ?? []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) });
      }
    } catch (err) {
      setError(err?.message ?? 'Impossible de charger le cours');
    } finally {
      setLoading(false);
    }
  }

  async function toggleModule(moduleId) {
    const next = new Set(expandedModules);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
      if (!lessons[moduleId]) {
        try {
          const data = await coursesApi.listLessons(moduleId);
          setLessons(l => ({ ...l, [moduleId]: (data ?? []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) }));
        } catch { setLessons(l => ({ ...l, [moduleId]: [] })); }
      }
    }
    setExpandedModules(next);
  }

  function isCompleted(lessonId) {
    return progress.some(p => p.lesson_id === lessonId && p.status === 'completed');
  }

  function onLessonComplete(lessonId) {
    setProgress(prev => {
      const existing = prev.find(p => p.lesson_id === lessonId);
      if (existing) return prev.map(p => p.lesson_id === lessonId ? { ...p, status: 'completed' } : p);
      return [...prev, { lesson_id: lessonId, status: 'completed' }];
    });
  }

  const totalLessons = Object.values(lessons).flat().length;
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const backPath = tenantSlug ? `/t/${tenantSlug}/admin/courses` : '/student-school-life/formations';

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
  if (error) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-red-600">{error}</p>
      <button className={BTN_GHOST} onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Retour</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <button className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" /> Retour aux cours
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{course?.title}</h1>
              {course?.description && <p className="mt-1 text-sm text-gray-500">{course.description}</p>}
            </div>
            {totalLessons > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500">{completedCount}/{totalLessons} leçons</p>
                  <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-600">{progressPct}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modules list */}
      <div className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {modules.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Ce cours n'a pas encore de modules.</p>
          </div>
        )}

        {modules.map((mod, i) => {
          const modLessons = lessons[mod.id] ?? [];
          const expanded = expandedModules.has(mod.id);
          const modCompleted = modLessons.length > 0 && modLessons.every(l => isCompleted(l.id));

          return (
            <div key={mod.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              {/* Module header */}
              <button
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50"
                onClick={() => toggleModule(mod.id)}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${modCompleted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {modCompleted ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{mod.title}</p>
                  {mod.description && <p className="text-xs text-gray-400 truncate">{mod.description}</p>}
                </div>
                <span className="shrink-0 text-xs text-gray-400">{modLessons.length} leçon(s)</span>
                {expanded
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
              </button>

              {/* Lessons */}
              {expanded && (
                <div className="divide-y border-t">
                  {modLessons.length === 0 && (
                    <p className="px-5 py-4 text-sm text-gray-400">Aucune leçon dans ce module.</p>
                  )}
                  {modLessons.map((lesson, j) => {
                    const done = isCompleted(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors"
                        onClick={() => setActiveLesson(lesson)}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                          {done
                            ? <CheckCircle className="h-5 w-5 text-green-500" />
                            : <Play className="h-4 w-4 text-blue-500" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {j + 1}. {lesson.title}
                          </p>
                          {lesson.video_url && <p className="text-[10px] text-blue-400">Vidéo</p>}
                          {lesson.content && !lesson.video_url && <p className="text-[10px] text-gray-400">Texte</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lesson player overlay */}
      {activeLesson && (
        <LessonPlayer
          lesson={activeLesson}
          onComplete={onLessonComplete}
          onClose={() => setActiveLesson(null)}
        />
      )}
    </div>
  );
}
