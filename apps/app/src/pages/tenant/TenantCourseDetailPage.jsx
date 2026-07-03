/**
 * TenantCourseDetailPage — /t/:tenantSlug/admin/courses/:courseId
 * Vue détail d'un cours : modules + leçons + player intégré.
 * Utilisé aussi depuis /student-school-life/cours/:courseId (route élève).
 * PARTAGÉE admin + élève → reskin du CONTENU uniquement (pas de shell).
 */
import { useEffect, useState, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Loader2, BookOpen, ChevronDown, ChevronRight, Layers, GraduationCap } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';
import supabase from '@/lib/customSupabaseClient';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { SafeHtml } from '@/components/common/SafeHtml';

// ── Design tokens CHAUDS (directive artistique LIRI : coral, bannir or/navy) ──────
// Les clés gardent leur nom historique (gold/goldDim/goldMid) pour un diff minimal ;
// leurs VALEURS sont désormais du coral. « gold » = coral #d97757 partout.
const T = {
  surface: '#1c1a17',
  surface2: 'rgba(245,241,233,0.05)',
  border: 'rgba(245,241,233,0.08)',
  borderMid: 'rgba(245,241,233,0.14)',
  gold: '#d97757',
  goldDim: 'rgba(217,119,87,0.12)',
  goldMid: 'rgba(217,119,87,0.30)',
  success: '#6cc08b',
  warning: '#e0a458',
  danger: '#f0a58a',
  t1: '#f5f1e9',
  t2: 'rgba(245,241,233,0.66)',
  t3: 'rgba(245,241,233,0.40)',
  t4: 'rgba(245,241,233,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

// ── Modes de cours (Phase 2, présentation adaptative) ────────────────────────────
const MODE_META = {
  cursus:      { label: 'Parcours',       hint: 'Progression structurée, semaine par semaine' },
  continue:    { label: 'Formation libre', hint: 'Accès complet, à ton rythme' },
  masterclass: { label: 'Masterclass',    hint: 'Session unique premium' },
};
const MODE_ORDER = ['cursus', 'continue', 'masterclass'];

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#14120f' }}>
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
            : { background: T.gold, color: '#14120f' }}
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
  const [mode, setMode] = useState('continue');       // Phase 2 : présentation adaptative
  const [modeBusy, setModeBusy] = useState(false);
  const [lockedWeeks, setLockedWeeks] = useState(() => new Set()); // #44 — semaines verrouillées (cursus)
  const [lockedAt, setLockedAt] = useState({});

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
        supabase.from('courses').select('id, title, description, category, status, mode').eq('id', courseId).maybeSingle(),
        fetchOutline(courseId),
        supabase.from('student_progress').select('lesson_id, status, course_id').eq('course_id', courseId),
      ]);
      setCourse(c || null);
      setMode(c?.mode || 'continue');
      const mods = outline?.data ?? [];
      setModules(mods.map((m) => ({ id: m.id, title: m.title })));
      const lessonsMap = {};
      for (const m of mods) lessonsMap[m.id] = m.lessons ?? [];
      setLessons(lessonsMap);
      if (mods.length > 0) setExpandedModules(new Set([mods[0].id]));
      setProgress(Array.isArray(prog) ? prog : []);
      // #44 — semaines verrouillées (n'a d'effet que si le cours est en mode cursus).
      const { data: locked } = await supabase.rpc('get_course_locked_week_ids', { p_course_id: courseId });
      const lw = Array.isArray(locked) ? locked : [];
      setLockedWeeks(new Set(lw.map((r) => r.week_id)));
      setLockedAt(Object.fromEntries(lw.map((r) => [r.week_id, r.unlock_at])));
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

  // Phase 2 — l'encadrant change le mode de présentation du cours (garde côté RPC :
  // set_course_mode refuse si l'appelant n'est pas encadrant du tenant).
  async function changeMode(target) {
    if (modeBusy || target === mode) return;
    setModeBusy(true);
    try {
      const { error: e } = await supabase.rpc('set_course_mode', { p_course_id: courseId, p_mode: target });
      if (e) throw e;
      setMode(target);
    } catch (_) { /* garde RPC = refus silencieux si pas encadrant */ }
    finally { setModeBusy(false); }
  }

  const totalLessons = Object.values(lessons).flat().length;
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Élève : '/student-school-life/cours' (sans :id) n'a PAS de route → page blanche
  // (audit élève #14). On renvoie vers le tableau de bord élève, qui existe et liste
  // les cours. (Admin : back vers la gestion des cours du tenant, inchangé.)
  const backPath = tenantSlug ? `/t/${tenantSlug}/admin/courses` : '/student-school-life/dashboard';

  // Shell conditionnel : la route élève (/student-school-life/cours/:id) est DÉJÀ rendue
  // dans le shell de StudentSchoolLifePage (sidebar + main lg:pl-[250px] + conteneur). Re-wrapper
  // dans TenantAdminShell créait un DOUBLE shell → 2 sidebars empilées + double décalage du
  // contenu vers la droite. La route admin (/t/:slug/admin/courses/:id) n'a aucun shell parent
  // → on fournit TenantAdminShell. slug présent = admin ; absent = élève.
  const Shell = tenantSlug ? TenantAdminShell : Fragment;

  if (loading) return (
    <Shell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.gold }} />
      </div>
    </Shell>
  );
  if (error) return (
    <Shell>
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
    </Shell>
  );

  const statusMeta = {
    published: { label: 'Publié', color: T.success, bg: 'rgba(34,197,94,0.14)' },
    draft: { label: 'Brouillon', color: T.warning, bg: 'rgba(245,158,11,0.14)' },
  }[course?.status] || { label: course?.status || 'Cours', color: T.t2, bg: 'rgba(245,241,233,0.06)' };
  const started = completedCount > 0;
  const C = (n) => (n > 1 ? 's' : '');

  return (
    <Shell>
      <style>{`
        @keyframes tcdFloat { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(0,-22px,0) scale(1.07)} }
        .tcd-orb{ filter: blur(86px); opacity:.2; animation: tcdFloat 16s ease-in-out infinite; will-change: transform; }
        .tcd-orb.alt{ animation-duration:20s; animation-delay:-4s; }
        @media (prefers-reduced-motion: reduce){ .tcd-orb{ animation:none } }
      `}</style>

    {/* ── Fond immersif PLEIN-CADRE : calque FIXE derrière tout, SANS bordure ni coins ── */}
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 bottom-0 right-0 left-0 z-0 overflow-hidden lg:left-[234px]"
      style={{ background: '#1c1a17' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 50% at 50% -5%, rgba(217,119,87,0.14), transparent 55%),' +
            'radial-gradient(65% 55% at 92% 104%, rgba(224,164,88,0.06), transparent 62%),' +
            'radial-gradient(55% 50% at 4% 98%, rgba(217,119,87,0.05), transparent 62%)',
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-[140vh] w-[140vh] -translate-x-1/2"
        style={{
          background:
            'conic-gradient(from 198deg at 50% 32%, transparent 0deg, rgba(217,119,87,0.10) 38deg, transparent 80deg, transparent 188deg, rgba(224,164,88,0.05) 224deg, transparent 300deg)',
          opacity: 0.42,
          filter: 'blur(3px)',
          WebkitMaskImage: 'radial-gradient(ellipse 50% 40% at 50% 28%, #000 0%, transparent 72%)',
          maskImage: 'radial-gradient(ellipse 50% 40% at 50% 28%, #000 0%, transparent 72%)',
        }}
      />
      <span className="tcd-orb absolute -left-10 top-16 h-72 w-72 rounded-full" style={{ background: '#d97757' }} />
      <span className="tcd-orb alt absolute -right-10 top-1/4 h-80 w-80 rounded-full" style={{ background: '#e0a458', opacity: 0.1 }} />
      <span className="tcd-orb absolute bottom-10 left-1/3 h-64 w-64 rounded-full" style={{ background: '#d97757', opacity: 0.09 }} />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 220px 50px rgba(0,0,0,0.5)' }} />
    </div>

    {/* ── Contenu CENTRÉ, au-dessus, SANS aucun cadre ────────────────── */}
    <div className="relative z-10 mx-auto w-full max-w-3xl px-2 pb-24 pt-1">
      {/* Retour (en haut, aligné à gauche) */}
      <button
        className="mb-10 inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: T.t3 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = T.gold; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = T.t3; }}
        onClick={() => navigate(backPath)}
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux cours
      </button>

      <div className="pt-4 md:pt-8">
        {/* ── Hero centré ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: T.goldDim, border: `1px solid ${T.goldMid}`, color: T.gold, boxShadow: '0 0 46px rgba(217,119,87,0.28)' }}
          >
            <GraduationCap className="h-7 w-7" />
          </span>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: statusMeta.bg, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: T.goldDim, color: T.gold, border: `1px solid ${T.goldMid}` }}
              title={MODE_META[mode]?.hint}
            >
              {MODE_META[mode]?.label || 'Formation libre'}
            </span>
          </div>
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

          {/* Sélecteur de mode — réservé encadrant (contexte admin = tenantSlug présent) */}
          {tenantSlug && (
            <div className="mt-5 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.t3 }}>Mode de présentation</span>
              <div className="flex gap-1.5">
                {MODE_ORDER.map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={modeBusy}
                      onClick={() => changeMode(m)}
                      title={MODE_META[m].hint}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        cursor: modeBusy ? 'wait' : 'pointer',
                        background: active ? T.gold : 'transparent',
                        color: active ? '#1c1a17' : T.t2,
                        border: `1px solid ${active ? T.gold : T.border}`,
                      }}
                    >
                      {MODE_META[m].label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/cours/${courseId}/deblocage`)}
                className="mt-1 text-[11px] font-semibold underline-offset-2 transition-colors hover:underline"
                style={{ color: T.gold }}
              >
                ⏱ Programmer le déblocage des semaines
              </button>
            </div>
          )}

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
            style={{ background: T.gold, color: '#1c1a17', boxShadow: '0 12px 36px rgba(217,119,87,0.34)' }}
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
          className="flex flex-col items-center justify-center py-16 text-center"
          style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}
        >
          <BookOpen className="mb-3 h-9 w-9" style={{ color: T.t4 }} />
          <p className="text-sm" style={{ color: T.t2 }}>Ce cours n'a pas encore de modules.</p>
          <p className="mt-1 text-xs" style={{ color: T.t3 }}>Ajoute du contenu depuis le Studio pour construire le programme.</p>
        </div>
      ) : (
        /* Liste à plat — pas de carte : fond la liste dans la scène (juste des filets) */
        <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
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
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,241,233,0.03)'; }}
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
                      const locked = lockedWeeks.has(lesson.week_id);
                      const unlockTxt = locked && lockedAt[lesson.week_id] ? new Date(lockedAt[lesson.week_id]).toLocaleDateString() : null;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={locked}
                          onClick={() => { if (!locked) navigate(`/formation/${courseId}/learn`); }}
                          title={locked ? (unlockTxt ? `Disponible le ${unlockTxt}` : 'Semaine verrouillée') : undefined}
                          className="group relative flex w-full items-center gap-3 rounded-xl py-3 pl-5 pr-3 text-left transition-colors"
                          style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
                          onMouseEnter={(e) => { if (!locked) e.currentTarget.style.background = T.goldDim; }}
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
                            {locked
                              ? <Lock className="h-3.5 w-3.5" style={{ color: T.t3 }} />
                              : done
                                ? <CheckCircle className="h-[18px] w-[18px]" style={{ color: T.success }} />
                                : <Play className="h-3.5 w-3.5" style={{ color: T.gold }} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm font-medium ${done ? 'line-through' : ''}`}
                              style={{ color: locked || done ? T.t3 : T.t1 }}
                            >
                              {lesson.title}
                            </span>
                          </span>
                          {locked
                            ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.gold }}>{unlockTxt ? `Dispo ${unlockTxt}` : 'Verrouillé'}</span>
                            : lesson.video_url
                              ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.gold }}>Vidéo</span>
                              : lesson.content
                                ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.t3 }}>Texte</span>
                                : null}
                          {!locked && (
                            <ChevronRight
                              className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                              style={{ color: T.gold }}
                            />
                          )}
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
    </Shell>
  );
}
