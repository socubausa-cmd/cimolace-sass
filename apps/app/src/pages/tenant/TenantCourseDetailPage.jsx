/**
 * TenantCourseDetailPage — /t/:tenantSlug/admin/courses/:courseId
 * Vue détail d'un cours : modules + leçons + player intégré.
 * Utilisé aussi depuis /student-school-life/cours/:courseId (route élève).
 * PARTAGÉE admin + élève → reskin du CONTENU uniquement (pas de shell).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, BookOpen, ChevronDown, ChevronRight, Layers, GraduationCap } from 'lucide-react';
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

  const statusMeta = {
    published: { label: 'Publié', color: T.success, bg: 'rgba(34,197,94,0.14)' },
    draft: { label: 'Brouillon', color: T.warning, bg: 'rgba(245,158,11,0.14)' },
  }[course?.status] || { label: course?.status || 'Cours', color: T.t2, bg: 'rgba(255,255,255,0.06)' };
  const started = completedCount > 0;
  const C = (n) => (n > 1 ? 's' : '');

  return (
    <TenantAdminShell>
      <style>{`
        @keyframes tcdFloat { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(0,-22px,0) scale(1.07)} }
        .tcd-orb{ filter: blur(74px); opacity:.22; animation: tcdFloat 15s ease-in-out infinite; will-change: transform; }
        .tcd-orb.alt{ animation-duration:19s; animation-delay:-4s; opacity:.18; }
        @media (prefers-reduced-motion: reduce){ .tcd-orb{ animation:none } }
      `}</style>

    {/* ── Scène immersive (le fond N'est PLUS plat) ─────────────────── */}
    <div
      className="relative overflow-hidden rounded-[28px]"
      style={{ minHeight: '82vh', background: '#0d0c14', border: `1px solid ${T.border}` }}
    >
      {/* halos + orbes flottants + rayons de lumière */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(95% 55% at 50% -8%, rgba(212,175,55,0.14), transparent 55%),' +
              'radial-gradient(72% 60% at 90% 108%, rgba(111,76,255,0.12), transparent 60%),' +
              'radial-gradient(60% 55% at 5% 96%, rgba(15,179,255,0.09), transparent 60%)',
          }}
        />
        <div
          className="absolute left-1/2 top-0 h-[130vh] w-[130vh] -translate-x-1/2"
          style={{
            background:
              'conic-gradient(from 198deg at 50% 34%, transparent 0deg, rgba(212,175,55,0.10) 38deg, transparent 80deg, transparent 188deg, rgba(15,179,255,0.07) 224deg, transparent 300deg)',
            opacity: 0.55,
            filter: 'blur(3px)',
            WebkitMaskImage: 'radial-gradient(ellipse 52% 42% at 50% 30%, #000 0%, transparent 72%)',
            maskImage: 'radial-gradient(ellipse 52% 42% at 50% 30%, #000 0%, transparent 72%)',
          }}
        />
        <span className="tcd-orb absolute -left-16 top-10 h-72 w-72 rounded-full" style={{ background: '#D4AF37' }} />
        <span className="tcd-orb alt absolute -right-16 top-1/4 h-80 w-80 rounded-full" style={{ background: '#6f4cff' }} />
        <span className="tcd-orb absolute bottom-8 left-1/3 h-64 w-64 rounded-full" style={{ background: '#0fb3ff' }} />
        {/* vignette pour la profondeur */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 40px rgba(0,0,0,0.55)' }} />
      </div>

      {/* Retour (haut-gauche) */}
      <button
        className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 text-sm transition-colors md:left-7 md:top-6"
        style={{ color: T.t3 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = T.gold; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = T.t3; }}
        onClick={() => navigate(backPath)}
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux cours
      </button>

      {/* Contenu CENTRÉ */}
      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-16 pt-24 md:pt-28">
        {/* ── Hero centré ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: T.goldDim, border: `1px solid ${T.goldMid}`, color: T.gold, boxShadow: '0 0 46px rgba(212,175,55,0.30)' }}
          >
            <GraduationCap className="h-7 w-7" />
          </span>
          <span
            className="mt-4 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: statusMeta.bg, color: statusMeta.color }}
          >
            {statusMeta.label}
          </span>
          <h1
            className="mt-5 text-3xl font-bold leading-[1.08] md:text-[40px]"
            style={{ color: T.t1, textWrap: 'balance', letterSpacing: '-0.02em' }}
          >
            {course?.title}
          </h1>
          {course?.description && (
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed" style={{ color: T.t2, textWrap: 'pretty' }}>
              {course.description}
            </p>
          )}

          {/* Méta : compteurs sobres, centrés */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" style={{ color: T.t2 }}>
            <span className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4" style={{ color: T.t3 }} />{modules.length} module{C(modules.length)}</span>
            <span className="inline-flex items-center gap-1.5"><Play className="h-4 w-4" style={{ color: T.t3 }} />{totalLessons} leçon{C(totalLessons)}</span>
            {course?.category && <span style={{ color: T.t3 }}>{course.category}</span>}
          </div>

          {/* Anneau de progression — seulement si l'élève a commencé */}
          {started && totalLessons > 0 && (
            <div className="mt-7 inline-flex items-center gap-2.5">
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={T.borderMid} strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke={T.gold} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 97.4} 97.4`}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold" style={{ color: T.gold }}>{progressPct}%</span>
              </div>
              <span className="text-left text-xs leading-tight" style={{ color: T.t3 }}>{completedCount}/{totalLessons}<br />terminé{C(completedCount)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(`/formation/${courseId}/learn`)}
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-transform active:scale-[0.99]"
            style={{ background: T.gold, color: '#0b0b0f', boxShadow: '0 12px 36px rgba(212,175,55,0.32)' }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <Play className="h-4 w-4" /> {started ? 'Reprendre le cours' : 'Accéder au cours'}
          </button>
        </div>

        {/* ── Programme ─────────────────────────────────────────────── */}
        <div className="mt-14 mb-4 text-center">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.t2 }}>Programme</h2>
          {totalLessons > 0 && (
            <p className="mt-1 text-xs" style={{ color: T.t3 }}>{modules.length} module{C(modules.length)} · {totalLessons} leçon{C(totalLessons)}</p>
          )}
        </div>

      {modules.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
          style={{ border: `1px dashed ${T.borderMid}`, background: 'rgba(18,17,26,0.5)' }}
        >
          <BookOpen className="mb-3 h-9 w-9" style={{ color: T.t4 }} />
          <p className="text-sm" style={{ color: T.t2 }}>Ce cours n'a pas encore de modules.</p>
          <p className="mt-1 text-xs" style={{ color: T.t3 }}>Ajoute du contenu depuis le Studio pour construire le programme.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${T.border}`, background: 'rgba(18,17,26,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 24px 70px rgba(0,0,0,0.34)' }}>
          {modules.map((mod, i) => {
            const modLessons = lessons[mod.id] ?? [];
            const expanded = expandedModules.has(mod.id);
            const modCompleted = modLessons.length > 0 && modLessons.every((l) => isCompleted(l.id));

            return (
              <div key={mod.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${T.border}` }}>
                {/* En-tête de module */}
                <button
                  className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors"
                  onClick={() => toggleModule(mod.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={modCompleted
                      ? { background: 'rgba(34,197,94,0.15)', color: T.success }
                      : { background: T.goldDim, color: T.gold }}
                  >
                    {modCompleted ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug" style={{ color: T.t1 }}>{mod.title}</p>
                    {mod.description && <p className="truncate text-xs" style={{ color: T.t3 }}>{mod.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: T.t3 }}>{modLessons.length} leçon{C(modLessons.length)}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-200"
                    style={{ color: T.t3, transform: expanded ? 'none' : 'rotate(-90deg)' }}
                  />
                </button>

                {/* Leçons — rail vertical (timeline), pas de carte imbriquée */}
                {expanded && (
                  <div className="pb-2 pl-[34px] pr-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    {modLessons.length === 0 && (
                      <p className="py-3 pl-5 text-sm" style={{ color: T.t3 }}>Aucune leçon dans ce module.</p>
                    )}
                    {modLessons.map((lesson, j) => {
                      const done = isCompleted(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => navigate(`/formation/${courseId}/learn`)}
                          className="group relative flex w-full items-center gap-3 rounded-xl py-3 pl-5 pr-3 text-left transition-colors"
                          onMouseEnter={(e) => { e.currentTarget.style.background = T.goldDim; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* rail */}
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 w-px"
                            style={{ background: T.border, height: j === modLessons.length - 1 ? '50%' : '100%' }}
                          />
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-px w-3.5"
                            style={{ background: T.border }}
                          />
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                            {done
                              ? <CheckCircle className="h-[18px] w-[18px]" style={{ color: T.success }} />
                              : <Play className="h-3.5 w-3.5" style={{ color: T.gold }} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm font-medium ${done ? 'line-through' : ''}`}
                              style={{ color: done ? T.t3 : T.t1 }}
                            >
                              {lesson.title}
                            </span>
                          </span>
                          {lesson.video_url
                            ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.gold }}>Vidéo</span>
                            : lesson.content
                              ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.t3 }}>Texte</span>
                              : null}
                          <ChevronRight
                            className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ color: T.gold }}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Lecteur leçon (overlay) */}
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
