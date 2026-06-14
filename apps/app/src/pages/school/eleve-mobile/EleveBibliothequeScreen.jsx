import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  ChevronRight,
  Search,
  SlidersHorizontal,
  MoreVertical,
  Check,
  Sparkles,
  Atom,
  Calculator,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  EleveMobileShell,
  EleveSectionTitle,
} from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLiriMobileEnrollmentPreview } from '@/hooks/useLiriMobileEnrollmentPreview';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_LINE, EV_R } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

/** Même filet d'atmosphère que l'agenda (aligné `EleveMobileShell`). */
const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

const CARD_INNER_HAZE =
  'radial-gradient(55% 40% at 8% 0%, rgba(59, 130, 246, 0.1), transparent 60%), radial-gradient(45% 35% at 100% 8%, rgba(124, 58, 237, 0.08), transparent 55%)';

const COURSE_ROW_HALO = [
  'rgba(99, 102, 241, 0.14)',
  'rgba(59, 130, 246, 0.12)',
  'rgba(124, 58, 237, 0.12)',
  'rgba(16, 185, 129, 0.1)',
  'rgba(168, 85, 247, 0.1)',
];

function progressCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 75% at 20% 0%, rgba(99, 102, 241, 0.22) 0%, transparent 58%)',
      'linear-gradient(150deg, rgba(22, 32, 58, 0.98) 0%, rgba(9, 14, 32, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.2)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.1)',
      '0 12px 36px -14px rgba(30, 64, 175, 0.35)',
      '0 4px 16px -4px rgba(0,0,0,0.45)',
    ].join(', '),
  };
}

function courseInProgressSurface(index) {
  const h = COURSE_ROW_HALO[index % COURSE_ROW_HALO.length];
  return {
    background: [
      `radial-gradient(ellipse 100% 80% at 50% 0%, ${h} 0%, transparent 55%)`,
      'linear-gradient(195deg, rgba(22, 24, 38, 0.97) 0%, rgba(10, 12, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 16px -6px rgba(0,0,0,0.4)',
  };
}

function courseDoneSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 0% 0%, rgba(16, 185, 129, 0.1) 0%, transparent 55%)',
      'linear-gradient(188deg, rgba(22, 30, 28, 0.98) 0%, rgba(12, 18, 16, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(52, 211, 153, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px -3px rgba(0,0,0,0.35)',
  };
}

function longiaRowSurface() {
  return {
    background: [
      'radial-gradient(ellipse 80% 70% at 0% 50%, rgba(123, 97, 255, 0.12) 0%, transparent 60%)',
      'linear-gradient(90deg, rgba(26, 24, 44, 0.95) 0%, rgba(16, 14, 28, 0.98) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px -4px rgba(99, 102, 241, 0.15)',
  };
}

const DEMO_IN_PROGRESS = [
  {
    id: 'd1',
    to: ELEVE_MOBILE.bibliotheque,
    title: 'Physique – Terminale S',
    sub: 'Chapitre 3 : Ondes et lumière',
    prof: 'Prof. Manikongo',
    percent: 75,
    accent: { badge: 'from-violet-500/90 to-fuchsia-600/80', bar: 'from-violet-500 to-fuchsia-500', pct: 'text-violet-400' },
    symbol: 'atom',
  },
  {
    id: 'd2',
    to: ELEVE_MOBILE.bibliotheque,
    title: 'Mathématiques – Terminale S',
    sub: 'Chapitre 5 : Suites numériques',
    prof: 'Prof. Kabasele',
    percent: 42,
    accent: { badge: 'from-emerald-500/90 to-teal-600/80', bar: 'from-emerald-400 to-teal-500', pct: 'text-emerald-400' },
    symbol: 'math',
  },
  {
    id: 'd3',
    to: ELEVE_MOBILE.bibliotheque,
    title: 'Chimie – Terminale S',
    sub: 'Chapitre 2 : Réactions chimiques',
    prof: 'Prof. Nguema',
    percent: 58,
    accent: { badge: 'from-violet-500/90 to-indigo-600/80', bar: 'from-violet-500 to-indigo-500', pct: 'text-violet-300' },
    symbol: 'flask',
  },
];

const DEMO_DONE = [
  {
    id: 'x1',
    to: ELEVE_MOBILE.bibliotheque,
    title: 'SVT – Terminale S',
    sub: "Chap. 1 : Génétique — Terminé",
    prof: 'Prof. A.',
    imageTone: 'from-emerald-900/50 to-cyan-900/40',
  },
];

function subjectIcon(key) {
  if (key === 'math') return Calculator;
  if (key === 'flask') return FlaskConical;
  return Atom;
}

function formationCoverStyle(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('math') || t.includes('calcul')) return 'from-emerald-900/50 via-slate-800/50 to-cyan-900/30';
  if (t.includes('chim')) return 'from-violet-900/50 via-indigo-900/40 to-slate-900/50';
  if (t.includes('phys')) return 'from-sky-900/50 via-blue-900/40 to-slate-900/50';
  return 'from-indigo-900/50 via-slate-800/50 to-fuchsia-900/40';
}

/** Group lesson-level rows by course, computing real per-course completion ratio. */
function groupByCourse(enrollments) {
  const map = new Map();
  for (const e of enrollments) {
    if (!e?.formations?.id) continue;
    const cid = e.formations.id;
    if (!map.has(cid)) map.set(cid, { f: e.formations, rows: [], firstId: e.id });
    map.get(cid).rows.push(e);
  }
  return [...map.values()].map(({ f, rows, firstId }) => {
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    return {
      f,
      id: firstId,
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      isDone: total > 0 && completed === total,
    };
  });
}

function buildCourseRowsFromEnrollments(enrollments) {
  return groupByCourse(enrollments)
    .filter((g) => !g.isDone)
    .map((g) => {
      const f = g.f;
      const t = f?.title || 'Formation';
      const sub = f?.description ? String(f.description).trim().slice(0, 80) : 'En cours de progression';
      return {
        id: g.id,
        to: f?.id ? ELEVE_MOBILE.course(f.id) : '/formations/mes-formations',
        title: t,
        sub,
        prof: 'Formateur LIRI',
        percent: g.percent,
        imageUrl: f?.image_url,
        imageTone: formationCoverStyle(t),
        symbol: t.toLowerCase().includes('math') ? 'math' : t.toLowerCase().includes('chim') ? 'flask' : 'atom',
        accent: {
          badge: 'from-violet-500/90 to-fuchsia-600/80',
          bar: 'from-violet-500 to-fuchsia-500',
          pct: 'text-violet-300',
        },
      };
    });
}

function buildDoneRowsFromEnrollments(enrollments) {
  return groupByCourse(enrollments)
    .filter((g) => g.isDone)
    .slice(0, 4)
    .map((g) => {
      const f = g.f;
      return {
        id: g.id,
        to: f?.id ? ELEVE_MOBILE.course(f.id) : '/formations/mes-formations',
        title: f?.title || 'Formation',
        sub: f?.description ? String(f.description).trim().slice(0, 60) : 'Terminé',
        prof: 'Formateur LIRI',
        imageUrl: f?.image_url,
        imageTone: formationCoverStyle(f?.title),
      };
    });
}

function CoursBibliothequeHeader() {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <LiriWordmark size="kicker" className="text-white/40" />
        <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Cours</h1>
        <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
          Explore, apprends, progresse
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          to="/formations/catalogue"
          className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
          style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
          aria-label="Catalogue formations"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
        <Link
          to="/formations/catalogue"
          className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
          style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
          aria-label="Filtres catalogue"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

function CoursSegmented({ value, onChange }) {
  const items = [
    { id: 'mes', label: 'Mes cours' },
    { id: 'tous', label: 'Tous les cours' },
    { id: 'cat', label: 'Catégories' },
  ];
  return (
    <div
      className="mb-5 flex rounded-[14px] border p-1"
      style={{
        borderColor: 'rgba(165, 180, 252, 0.18)',
        background: 'linear-gradient(180deg, rgba(22, 24, 40, 0.85) 0%, rgba(10, 10, 20, 0.92) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 14px -6px rgba(0,0,0,0.45)',
      }}
    >
      {items.map((it) => {
        const on = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              'flex-1 rounded-[10px] py-2.5 text-center text-[12.5px] font-semibold transition-all duration-200',
              on ? 'text-white' : 'text-white/45',
            )}
            style={
              on
                ? {
                    background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)',
                    boxShadow: [
                      '0 0 0 1px rgba(255,255,255,0.12)',
                      '0 4px 18px -4px rgba(99, 102, 241, 0.45)',
                      '0 2px 8px -2px rgba(0,0,0,0.35)',
                    ].join(', '),
                  }
                : undefined
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function GlobalProgressCard({ globalPct, coursEnCours, loading }) {
  const pct = Math.max(0, Math.min(100, Number(globalPct) || 0));
  const r = 40;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-6 overflow-hidden rounded-2xl p-4"
      style={{ borderRadius: EV_R.lg, ...progressCardSurface() }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: CARD_INNER_HAZE }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, transparent 70%)' }}
      />
      <div className="relative flex items-start gap-2 sm:gap-3">
        <div className="relative h-[100px] w-[100px] shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="url(#gc)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
              <p className="text-[6px] font-extrabold uppercase leading-tight tracking-[0.12em] text-white/50">
                Ton avancée
              </p>
              <GraduationCap className="mt-0.5 h-5 w-5 text-white/90" strokeWidth={1.8} />
              {loading ? (
                <span className="mt-1.5 h-6 w-10 animate-pulse rounded bg-white/20" />
              ) : (
                <p className="mt-0.5 text-[18px] font-extrabold leading-none text-white">{Math.round(pct)}%</p>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[13px] font-semibold text-white/90">Parcours actifs</p>
            <p className="mt-0.5 text-[11px] text-white/50">Poursuis où tu t&apos;es arrêté(e)</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)',
                }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-white/50">
              {loading ? '…' : `${coursEnCours} cours en cours`}
            </p>
          </div>
        <div className="flex w-[80px] shrink-0 items-start justify-end self-stretch pt-0.5 sm:w-[100px]" aria-hidden>
          <BarChartArt />
        </div>
      </div>
    </motion.div>
  );
}

function BarChartArt() {
  return (
    <svg viewBox="0 0 100 90" className="h-full w-full opacity-90">
      <defs>
        <linearGradient id="b1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#4F46E5" stopOpacity="0.4" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M50 4 L60 8 L58 20 Z" fill="#A855F7" filter="url(#glow)" />
      <rect x="18" y="40" width="16" height="40" rx="3" fill="url(#b1)" opacity="0.9" />
      <rect x="42" y="25" width="16" height="55" rx="3" fill="url(#b1)" />
      <rect x="66" y="32" width="16" height="48" rx="3" fill="url(#b1)" opacity="0.75" />
    </svg>
  );
}

function CourseCardInProgress({ row, index }) {
  const Icon = subjectIcon(row.symbol);
  const to = row.to || ELEVE_MOBILE.bibliotheque;
  return (
    <Link to={to} className="mb-3 block last:mb-0">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 * index }}
        className="relative overflow-hidden rounded-2xl p-3"
        style={{ borderRadius: EV_R.md, ...courseInProgressSurface(index) }}
      >
        <div className="flex gap-3">
          <div className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-xl">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className={cn('h-full w-full bg-gradient-to-br', row.imageTone || 'from-slate-800 to-slate-900')}
              />
            )}
            <div className="absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-sm">
              <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.1} />
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-0.5 pr-1">
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  'inline-flex rounded-md bg-gradient-to-r px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white',
                  row.accent.badge,
                )}
              >
                En cours
              </span>
              <button
                type="button"
                className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 hover:text-white/70"
                onClick={(e) => e.preventDefault()}
                aria-label="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 line-clamp-1 text-[14px] font-bold leading-tight text-white">{row.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-white/55">{row.sub}</p>
            <p className="mt-1 text-[10.5px] text-white/45">{row.prof}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r', row.accent.bar)}
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <span className={cn('text-[12px] font-bold tabular-nums', row.accent.pct)}>{row.percent}%</span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function CourseCardDone({ row, index }) {
  const to = row.to || ELEVE_MOBILE.bibliotheque;
  return (
    <Link to={to} className="mb-2.5 block last:mb-0">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * index }}
        className="relative flex gap-2.5 overflow-hidden rounded-2xl p-2.5"
        style={{ borderRadius: EV_R.md, ...courseDoneSurface() }}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className={cn('h-full w-full bg-gradient-to-br', row.imageTone)} />
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5 pr-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex rounded-md bg-gradient-to-r from-emerald-600/90 to-emerald-500/80 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-widest text-white">
              Terminé
            </span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[13px] font-bold text-white">{row.title}</p>
          <p className="line-clamp-1 text-[10.5px] text-white/50">{row.sub}</p>
        </div>
      </motion.div>
    </Link>
  );
}

function LongiaHelpRow() {
  return (
    <Link
      to={ELEVE_MOBILE.neuron}
      className="mb-2 flex items-center gap-3 rounded-2xl px-3.5 py-3.5 transition-transform active:scale-[0.99]"
      style={{ borderRadius: EV_R.lg, ...longiaRowSurface() }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/12 text-violet-200 shadow-[0_0_20px_-4px_rgba(123,97,255,0.4)]">
        <Sparkles className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-white">Besoin d&apos;aide ?</p>
        <p className="mt-0.5 text-[12px] text-white/55">Pose une question à Longia IA</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </Link>
  );
}

export default function EleveBibliothequeScreen() {
  const { user } = useAuth();
  const { enrollments, loading, progressLabel, progressPercent } = useLiriMobileEnrollmentPreview(user?.id);
  const [tab, setTab] = useState('mes');

  // Group lesson-level rows by course to count courses (not lessons) and compute real global %
  const courseGroups = useMemo(() => groupByCourse(enrollments), [enrollments]);
  const inProgressCount = useMemo(() => courseGroups.filter((g) => !g.isDone).length, [courseGroups]);
  const completedCount = useMemo(() => courseGroups.filter((g) => g.isDone).length, [courseGroups]);
  const total = courseGroups.length;

  const inProgressRows = useMemo(() => {
    const fromDb = buildCourseRowsFromEnrollments(enrollments);
    if (fromDb.length) return fromDb;
    if (total === 0) return DEMO_IN_PROGRESS;
    return [];
  }, [enrollments, total]);

  const doneRows = useMemo(() => {
    const fromDb = buildDoneRowsFromEnrollments(enrollments);
    if (fromDb.length) return fromDb;
    if (total === 0) return DEMO_DONE;
    return [];
  }, [enrollments, total]);

  return (
    <EleveMobileShell
      user={user}
      hideHeader
      contentClassName="!px-0"
    >
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2">
        <CoursBibliothequeHeader />
        <CoursSegmented value={tab} onChange={setTab} />

        <AnimatePresence mode="wait">
          {tab === 'mes' && (
            <motion.div
              key="mes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GlobalProgressCard
                globalPct={progressPercent}
                coursEnCours={inProgressCount}
                loading={loading}
              />
              {!loading && total === 0 ? (
                <p className="mb-3 -mt-3 text-center text-[10px] text-white/35">Inscris-toi à un cours pour voir ta progression</p>
              ) : null}

              <EleveSectionTitle action="Voir tout" actionTo="/formations/mes-formations" className="mb-3" actionClassName="!text-violet-400">
                En cours
              </EleveSectionTitle>
              {inProgressRows.map((row, i) => (
                <CourseCardInProgress key={row.id} row={row} index={i} />
              ))}

              <div className="mt-1">
                <EleveSectionTitle action="Voir tout" actionTo="/formations/mes-formations" className="mb-3" actionClassName="!text-violet-400">
                  Terminés récemment
                </EleveSectionTitle>
                {doneRows.map((row, i) => (
                  <CourseCardDone key={row.id} row={row} index={i} />
                ))}
              </div>

              <div className="mt-2">
                <LongiaHelpRow />
              </div>
            </motion.div>
          )}

          {tab === 'tous' && (
            <motion.div
              key="tous"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pb-4"
            >
              <p className="text-[14px] leading-relaxed" style={{ color: EV_MUTED }}>
                Parcours toutes les formations disponibles et inscris-toi en quelques clics.
              </p>
              <Link
                to="/formations/catalogue"
                className="mt-4 flex h-12 items-center justify-center gap-1 rounded-2xl text-[15px] font-bold text-white transition-transform active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)',
                  boxShadow: [
                    '0 8px 28px -6px rgba(79, 70, 229, 0.55)',
                    'inset 0 1px 0 rgba(255,255,255,0.15)',
                  ].join(', '),
                }}
              >
                Ouvrir le catalogue
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}

          {tab === 'cat' && (
            <motion.div
              key="cat"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-3 pb-4"
            >
              {['Sciences', 'Maths', 'Langues', 'Histoire', 'Art & design', 'Prépa'].map((c, i) => (
                <Link
                  key={c}
                  to="/formations/catalogue"
                  className="flex flex-col items-center justify-center rounded-2xl px-3 py-6 text-center active:scale-[0.98]"
                  style={courseInProgressSurface(i + 2)}
                >
                  <BookOpen className="mb-2 h-6 w-6 text-violet-300/90" />
                  <span className="text-[13px] font-semibold text-white/90">{c}</span>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 pb-2 text-center text-[9px] uppercase tracking-[0.2em] text-white/20">
          {progressLabel || 'Parcours LIRI'}
        </p>
        </div>
      </div>
    </EleveMobileShell>
  );
}
