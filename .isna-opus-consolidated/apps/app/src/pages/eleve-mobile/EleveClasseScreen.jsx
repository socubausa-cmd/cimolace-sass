import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Megaphone, Users, Folder, BarChart2, Play, ArrowLeft, CalendarDays, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  EV_BG,
  EV_MUTED,
  EV_ACCENT,
  EV_LINE,
  EV_R,
  EV_SH,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';

const HERO =
  'linear-gradient(140deg, #1e0b3d 0%, #4C1D95 28%, #5B21B6 45%, #7B61FF 58%, #312e81 100%)';

/** Halos légèrement différenciés par tuile (Lun.– style cases agenda). */
const ACTION_TILE_HALO = [
  'rgba(124, 58, 237, 0.16)',
  'rgba(59, 130, 246, 0.16)',
  'rgba(245, 158, 11, 0.14)',
  'rgba(16, 185, 129, 0.15)',
];

function actionTileStyle(index) {
  const h = ACTION_TILE_HALO[index] ?? ACTION_TILE_HALO[0];
  return {
    background: [
      `radial-gradient(ellipse 100% 80% at 50% 0%, ${h} 0%, transparent 58%)`,
      'linear-gradient(192deg, rgba(26, 28, 44, 0.97) 0%, rgba(12, 14, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.2)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px -4px rgba(15, 23, 42, 0.5)',
  };
}

function annonceCardStyle() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 12% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 55%)',
      'linear-gradient(188deg, rgba(24, 24, 36, 0.98) 0%, rgba(14, 14, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px -3px rgba(0,0,0,0.4)',
  };
}

function sondageCardStyle() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(16, 185, 129, 0.12) 0%, transparent 58%)',
      'linear-gradient(190deg, rgba(22, 32, 30, 0.98) 0%, rgba(12, 18, 20, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(52, 211, 153, 0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px -3px rgba(0,0,0,0.35)',
  };
}

const TILES = [
  {
    to: `${ELEVE_MOBILE.classe}#annonces`,
    icon: Megaphone,
    label: 'Annonces',
    badge: 3,
    iconRing: 'border-violet-500/30 bg-violet-500/15',
    iconColor: 'text-violet-200',
  },
  {
    to: `${ELEVE_MOBILE.classe}#membres`,
    icon: Users,
    label: 'Membres',
    iconRing: 'border-sky-500/30 bg-sky-500/12',
    iconColor: 'text-sky-200',
  },
  {
    to: ELEVE_MOBILE.bibliotheque,
    icon: Folder,
    label: 'Documents',
    iconRing: 'border-amber-500/30 bg-amber-500/12',
    iconColor: 'text-amber-200',
  },
  {
    to: `${ELEVE_MOBILE.classe}#sondages`,
    icon: BarChart2,
    label: 'Sondages',
    iconRing: 'border-emerald-500/30 bg-emerald-500/12',
    iconColor: 'text-emerald-200',
  },
];

const ANNONCES = [
  {
    who: 'Prof. Manikongo',
    t: 'Il y a 2h',
    tag: 'IMPORTANT',
    tagC: { bg: 'bg-violet-500/18', t: 'text-violet-200', border: 'border border-violet-500/30' },
    text: 'Devoir chapitre 3 — à rendre pour vendredi…',
  },
  {
    who: 'Grace L.',
    t: 'Hier',
    tag: 'RAPPEL',
    tagC: { bg: 'bg-sky-500/15', t: 'text-sky-200', border: 'border border-sky-500/25' },
    text: 'Groupe de travail samedi 10h salle 4.',
  },
];

const EN_LIGNE = [
  { n: 'Sam', c: 'from-amber-400 to-rose-500' },
  { n: 'Léa', c: 'from-sky-400 to-indigo-500' },
  { n: 'Moi', c: 'from-emerald-400 to-cyan-500' },
  { n: 'Jules', c: 'from-fuchsia-400 to-violet-600' },
];

function CapBooksArt() {
  return (
    <svg viewBox="0 0 120 100" className="h-[88px] w-[104px] shrink-0 drop-shadow-[0_12px_28px_rgba(123,97,255,0.35)]" aria-hidden>
      <defs>
        <linearGradient id="cl-cap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="cl-bk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
      </defs>
      <rect x="18" y="55" width="24" height="32" rx="2" fill="url(#cl-bk)" opacity="0.95" />
      <rect x="48" y="48" width="24" height="40" rx="2" fill="url(#cl-cap)" />
      <rect x="78" y="60" width="20" height="28" rx="2" fill="#4c1d95" />
      <path d="M58 28 L40 38 L40 50 L60 50 L60 32 Z" fill="url(#cl-cap)" />
      <ellipse cx="50" cy="32" rx="20" ry="4.5" fill="#0a0a12" opacity="0.25" />
    </svg>
  );
}

function ActionTile({ to, icon: Icon, label, badge, iconRing, iconColor, index = 0 }) {
  return (
    <Link to={to} className="block">
      <div
        className="relative flex min-h-[88px] flex-col items-center justify-center gap-2 py-3 transition active:scale-[0.99]"
        style={{ borderRadius: EV_R.md, ...actionTileStyle(index) }}
      >
        {badge != null ? (
          <span
            className="absolute right-2 top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white"
            style={{ boxShadow: `0 0 0 2px ${EV_BG}` }}
          >
            {badge}
          </span>
        ) : null}
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-[14px] border', iconRing)}>
          <Icon className={cn('h-5 w-5', iconColor)} strokeWidth={2.1} />
        </div>
        <span className="text-center text-[11.5px] font-semibold leading-tight text-white/95">{label}</span>
      </div>
    </Link>
  );
}

/**
 * Bandeau contextuel affiché quand on arrive depuis le calendrier annuel.
 * Montre la semaine en cours + CTA "Entrer dans le cours".
 */
function WeekContextBanner({ weekId, weekNumber, weekTitle, onEnterCourse, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mb-4 overflow-hidden"
      style={{
        borderRadius: EV_R.lg,
        background: 'linear-gradient(135deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 100%)',
        border: '1px solid rgba(212,175,55,0.28)',
        boxShadow: '0 4px 20px rgba(212,175,55,0.08)',
      }}
    >
      <div className="p-4">
        {/* Ligne titre */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              <CalendarDays className="h-4 w-4" style={{ color: EV_ACCENT }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(212,175,55,0.7)' }}>
                Semaine {weekNumber} · Calendrier scolaire
              </p>
              <p className="text-[14px] font-extrabold leading-tight text-white truncate">
                {weekTitle || `Semaine ${weekNumber}`}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-full"
            style={{ color: EV_MUTED, background: 'rgba(255,255,255,0.06)' }}
            aria-label="Fermer"
          >
            <span style={{ fontSize: 12 }}>✕</span>
          </button>
        </div>

        {/* CTA Entrer dans le cours */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onEnterCourse}
          className="flex w-full items-center justify-center gap-2"
          style={{
            borderRadius: EV_R.md,
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #D4AF37 0%, #f59e0b 100%)',
            color: '#0B0B0F',
            fontWeight: 800,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(212,175,55,0.35)',
          }}
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Entrer dans le cours
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function EleveClasseScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  // État reçu depuis le calendrier annuel
  const { weekId, weekNumber, weekTitle, fromCalendar } = location.state ?? {};
  const [showWeekBanner, setShowWeekBanner] = React.useState(!!fromCalendar);

  const handleEnterCourse = () => {
    if (weekId) {
      navigate(ELEVE_MOBILE.course(weekId), {
        state: { weekId, weekNumber, weekTitle, fromCalendar: true },
      });
    } else {
      // Fallback : ouvre la classe (contenu général)
      navigate(ELEVE_MOBILE.bibliotheque);
    }
  };

  return (
    <EleveMobileShell user={user} notificationCount={unread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: 'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)',
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          {/* Bouton retour si on vient du calendrier */}
          {fromCalendar && (
            <motion.button
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate(-1)}
              className="mb-3 flex items-center gap-1.5"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: EV_MUTED, padding: 0 }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-[12px] font-medium">Retour au calendrier</span>
            </motion.button>
          )}

          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Ma classe</h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                {fromCalendar && weekTitle
                  ? `Semaine ${weekNumber} · ${weekTitle}`
                  : 'Terminale S · espace de classe'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                to={ELEVE_MOBILE.bibliotheque}
                className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
                aria-label="Cours et documents"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </Link>
              <Link
                to={ELEVE_MOBILE.communaute}
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
                  boxShadow: EV_SH.cta,
                }}
                aria-label="Communauté"
              >
                <Plus className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bandeau contextuel semaine — visible seulement depuis le calendrier */}
        <AnimatePresence>
          {showWeekBanner && (
            <WeekContextBanner
              weekId={weekId}
              weekNumber={weekNumber}
              weekTitle={weekTitle}
              onEnterCourse={handleEnterCourse}
              onDismiss={() => setShowWeekBanner(false)}
            />
          )}
        </AnimatePresence>

        <div className="px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-5 overflow-hidden border p-4"
          style={{
            borderRadius: EV_R.lg,
            background: HERO,
            borderColor: 'rgba(123, 97, 255, 0.3)',
            boxShadow: EV_SH.hero,
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-50 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, transparent 70%)' }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[20px] font-extrabold leading-tight text-white">Terminale S</p>
              <p className="mt-1 text-[12.5px] text-violet-100/90">Physique · 28 élèves</p>
            </div>
            <CapBooksArt />
          </div>
        </motion.div>

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          {TILES.map((t, i) => (
            <ActionTile key={t.label} {...t} index={i} />
          ))}
        </div>

        <div id="sondages" className="scroll-mt-6 mb-5 rounded-2xl p-3.5" style={sondageCardStyle()}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200/60">Sondages</p>
          <p className="mt-1 text-[12.5px]" style={{ color: EV_MUTED }}>
            Aucun sondage en cours — reviens bientôt ou demande à ton prof.
          </p>
        </div>

        <div id="annonces" className="scroll-mt-6">
        <EleveSectionTitle
          action="Voir tout"
          actionTo={ELEVE_MOBILE.classe}
          className="mb-2.5"
          actionClassName="!text-violet-400/95"
        >
          Annonces récentes
        </EleveSectionTitle>
        <div className="mb-6 space-y-2.5">
          {ANNONCES.map((a, i) => (
            <div
              key={i}
              className="p-3.5"
              style={{ borderRadius: EV_R.md, ...annonceCardStyle() }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-white">{a.who}</p>
                    <span className="shrink-0 text-[10.5px]" style={{ color: EV_MUTED }}>
                      {a.t}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'mt-1.5 inline-block rounded-md px-2 py-0.5 text-[7.5px] font-extrabold tracking-wide',
                      a.tagC.bg,
                      a.tagC.t,
                      a.tagC.border,
                    )}
                  >
                    {a.tag}
                  </span>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.45]" style={{ color: EV_MUTED }}>
                    {a.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>

        <p id="membres" className="mb-2.5 scroll-mt-6 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-200/45">Membres · en ligne</p>
        <div className="flex max-w-full items-center gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EN_LIGNE.map((m) => (
            <div key={m.n} className="flex shrink-0 flex-col items-center gap-1">
              <div
                className={cn('h-11 w-11 rounded-full bg-gradient-to-br p-0.5', m.c)}
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0B0B0F] text-[10px] font-bold text-white/90">
                  {m.n[0]}
                </div>
              </div>
              <span className="max-w-[3.5rem] truncate text-[10px]" style={{ color: EV_MUTED }}>
                {m.n}
              </span>
            </div>
          ))}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.45)' }}
            >
              +24
            </div>
            <span className="text-[10px] font-medium text-emerald-400/95">En ligne</span>
          </div>
        </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
