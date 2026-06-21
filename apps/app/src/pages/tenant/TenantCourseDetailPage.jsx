/**
 * TenantCourseDetailPage — /t/:tenantSlug/admin/courses/:courseId
 * Vue détail d'un cours : modules + leçons + player intégré.
 * Utilisé aussi depuis /student-school-life/cours/:courseId (route élève).
 * PARTAGÉE admin + élève → reskin du CONTENU uniquement (pas de shell).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';
import supabase from '@/lib/customSupabaseClient';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { SafeHtml } from '@/components/common/SafeHtml';

// ── Design tokens navy + or ─────────────────────────────────────────────────────
const T = {
  surface: '#12111a',
  surface2: 'rgba(25,39,52,0.5)',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.12)',
  goldMid: 'rgba(212,175,55,0.28)',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0910' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: T.t2 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.t1; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.t2; }}
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <h2 className="text-sm font-medium" style={{ color: T.t1 }}>{lesson.title}</h2>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
          style={completed
            ? { background: T.goldDim, color: T.gold, border: `1px solid ${T.goldMid}` }
            : { background: T.gold, color: '#0a0910' }}
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
            <SafeHtml
              className="max-w-2xl rounded-xl p-8 prose prose-invert"
              style={{ background: T.surface2, color: T.t1, border: `1px solid ${T.border}` }}
              html={lesson.content}
            />
          ) : (
            <div className="flex flex-col items-center gap-3" style={{ color: T.t3 }}>
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
  const { fetchOutline } = useFormationStructure();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState({}); // { [moduleId]: lesson[] }
  const [progress, setProgress] = useState([]); // lesson progress records
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [activeLesson, setActiveLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [courseId]);

  // P1 + P3 — modèle de cours UNIFIÉ via le hook partagé useFormationStructure :
  // fetchOutline() lit le VRAI contenu studio (modules → formation_weeks →
  // formation_days → formation_day_contents, la même source que le player
  // /formation/:id/learn) et l'aplatit en modules → leçons. Plus de requête
  // dupliquée ici → une seule source de vérité pour le plan d'un cours.
  async function load() {
    setLoading(true); setError(null);
    try {
      const [{ data: c }, outline, { data: prog }] = await Promise.all([
        supabase.from('courses').select('id, title, description, category, status').eq('id', courseId).maybeSingle(),
        fetchOutline(courseId),
        supabase.from('student_progress').select('lesson_id, status, course_id').eq('course_id', courseId),
      ]);
      setCourse(c || null);
      const mods = outline?.data ?? [];
      setModules(mods.map((m) => ({ id: m.id, title: m.title })));
      const lessonsMap = {};
      for (const m of mods) lessonsMap[m.id] = m.lessons ?? [];
      setLessons(lessonsMap);
      if (mods.length > 0) setExpandedModules(new Set([mods[0].id]));
      setProgress(Array.isArray(prog) ? prog : []);
    } catch (err) {
      setError(err?.message ?? 'Impossible de charger le cours');
    } finally {
      setLoading(false);
    }
  }

  // Tout est chargé en une requête imbriquée → le toggle ne fait que plier/déplier.
  function toggleModule(moduleId) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
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

  const backPath = tenantSlug ? `/t/${tenantSlug}/admin/courses` : '/student-school-life/cours';

  if (loading) return (
    <TenantAdminShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.gold }} />
      </div>
    </TenantAdminShell>
  );
  if (error) return (
    <TenantAdminShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p style={{ color: T.danger }}>{error}</p>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors"
          style={{ border: `1px solid ${T.border}`, color: T.t2 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.t1; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.t2; }}
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>
    </TenantAdminShell>
  );

  return (
    <TenantAdminShell>
    <div className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      {/* Header */}
      <div className="px-6 py-5" style={{ borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
        <div className="mx-auto max-w-4xl">
          <button
            className="mb-3 flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: T.t3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.t3; }}
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux cours
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: T.t1 }}>{course?.title}</h1>
              {course?.description && <p className="mt-1 text-sm" style={{ color: T.t2 }}>{course.description}</p>}
              <button
                type="button"
                onClick={() => navigate(`/formation/${courseId}/learn`)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-transform active:scale-[0.99]"
                style={{ background: T.gold, color: '#0b0b0f' }}
              >
                <Play className="h-4 w-4" /> Accéder au cours
              </button>
            </div>
            {totalLessons > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs" style={{ color: T.t3 }}>{completedCount}/{totalLessons} leçons</p>
                  <div className="mt-1 h-2 w-32 overflow-hidden rounded-full" style={{ background: T.borderMid }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: T.gold }} />
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: T.gold }}>{progressPct}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modules list */}
      <div className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {modules.length === 0 && (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
            style={{ border: `2px dashed ${T.borderMid}`, background: T.surface2 }}
          >
            <BookOpen className="mb-3 h-10 w-10" style={{ color: T.t4 }} />
            <p className="text-sm" style={{ color: T.t3 }}>Ce cours n'a pas encore de modules.</p>
          </div>
        )}

        {modules.map((mod, i) => {
          const modLessons = lessons[mod.id] ?? [];
          const expanded = expandedModules.has(mod.id);
          const modCompleted = modLessons.length > 0 && modLessons.every(l => isCompleted(l.id));

          return (
            <div
              key={mod.id}
              className="overflow-hidden rounded-xl"
              style={{ border: `1px solid ${T.border}`, background: T.surface2 }}
            >
              {/* Module header */}
              <button
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
                onClick={() => toggleModule(mod.id)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={modCompleted
                    ? { background: 'rgba(34,197,94,0.15)', color: T.success }
                    : { background: T.goldDim, color: T.gold }}
                >
                  {modCompleted ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: T.t1 }}>{mod.title}</p>
                  {mod.description && <p className="text-xs truncate" style={{ color: T.t3 }}>{mod.description}</p>}
                </div>
                <span className="shrink-0 text-xs" style={{ color: T.t3 }}>{modLessons.length} leçon(s)</span>
                {expanded
                  ? <ChevronDown className="h-4 w-4 shrink-0" style={{ color: T.t3 }} />
                  : <ChevronRight className="h-4 w-4 shrink-0" style={{ color: T.t3 }} />}
              </button>

              {/* Lessons */}
              {expanded && (
                <div style={{ borderTop: `1px solid ${T.border}` }}>
                  {modLessons.length === 0 && (
                    <p className="px-5 py-4 text-sm" style={{ color: T.t3 }}>Aucune leçon dans ce module.</p>
                  )}
                  {modLessons.map((lesson, j) => {
                    const done = isCompleted(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors"
                        style={{ borderTop: j === 0 ? 'none' : `1px solid ${T.border}` }}
                        onClick={() => navigate(`/formation/${courseId}/learn`)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = T.goldDim; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                          {done
                            ? <CheckCircle className="h-5 w-5" style={{ color: T.success }} />
                            : <Play className="h-4 w-4" style={{ color: T.gold }} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${done ? 'line-through' : ''}`}
                            style={{ color: done ? T.t3 : T.t1 }}
                          >
                            {j + 1}. {lesson.title}
                          </p>
                          {lesson.video_url && <p className="text-[10px]" style={{ color: T.gold }}>Vidéo</p>}
                          {lesson.content && !lesson.video_url && <p className="text-[10px]" style={{ color: T.t3 }}>Texte</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: T.t4 }} />
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
    </TenantAdminShell>
  );
}
