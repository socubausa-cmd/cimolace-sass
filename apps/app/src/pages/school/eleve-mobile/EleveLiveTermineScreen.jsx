import React, { useCallback, useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Play,
  Share2,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import {
  EleveMobileShell,
  EleveSectionTitle,
} from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_CARD, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.14), transparent 70%)';
const R = 42;
const C = 2 * Math.PI * R;

const CONFETTI = [
  { l: '8%', t: '18%', c: '#d97757', r: 4, rot: -12 },
  { l: '78%', t: '12%', c: '#22C55E', r: 3, rot: 20 },
  { l: '18%', t: '72%', c: '#F59E0B', r: 3.5, rot: 8 },
  { l: '88%', t: '58%', c: '#e2854f', r: 3, rot: -25 },
  { l: '42%', t: '8%', c: '#EC4899', r: 2.5, rot: 15 },
  { l: '65%', t: '78%', c: '#e0926a', r: 3, rot: -8 },
];

const LEARN_TILES = [
  {
    to: `${ELEVE_MOBILE.replays}?from=live`,
    label: 'Voir le replay',
    sub: 'Regarde le cours en replay',
    icon: Play,
    accent: 'from-orange-600 to-amber-700',
    glow: 'rgba(217, 119, 87, 0.45)',
  },
  {
    to: ELEVE_MOBILE.neuron,
    label: 'Résumé IA',
    sub: 'Obtiens le résumé du cours',
    icon: FileText,
    accent: 'from-emerald-600 to-amber-700',
    glow: 'rgba(34, 197, 94, 0.4)',
  },
  {
    to: ELEVE_MOBILE.messages,
    label: 'Prendre des notes',
    sub: 'Revois et complète tes notes',
    icon: ClipboardList,
    accent: 'from-orange-600 to-amber-700',
    glow: 'rgba(226, 133, 79, 0.4)',
  },
  {
    to: ELEVE_MOBILE.bibliotheque,
    label: 'Quiz & exercices',
    sub: 'Teste tes connaissances sur le cours',
    icon: Star,
    accent: 'from-amber-500 to-orange-600',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
];

const NOTIONS = [
  'Interférences constructives et destructives',
  'Diffraction de la lumière',
  'Expériences et applications',
];

function ConfettiRing() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {CONFETTI.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-sm opacity-80"
          style={{
            left: d.l,
            top: d.t,
            width: d.r,
            height: d.r * 1.6,
            background: d.c,
            transform: `rotate(${d.rot}deg)`,
            boxShadow: `0 0 8px ${d.c}88`,
          }}
        />
      ))}
    </div>
  );
}

function ChapterProgressRing({ pct }) {
  const gradId = useId().replace(/:/g, '');
  const dash = Math.max(0, (pct / 100) * C);
  return (
    <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-xl"
        style={{ background: 'radial-gradient(circle, rgba(217, 119, 87, 0.5) 0%, transparent 70%)' }}
        aria-hidden
      />
      <svg className="relative z-10 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97757" />
            <stop offset="100%" stopColor="#e0926a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
        <span className="text-[22px] font-extrabold text-white leading-none">{pct}%</span>
        <span className="mt-0.5 max-w-[4.2rem] text-[9px] font-medium leading-tight" style={{ color: EV_MUTED }}>
          du chapitre
        </span>
      </div>
    </div>
  );
}

function LearningTile({ to, label, sub, icon: Icon, accent, glow }) {
  return (
    <Link
      to={to}
      className="relative block overflow-hidden p-3.5 transition active:scale-[0.99]"
      style={{
        background: EV_CARD,
        boxShadow: `0 8px 28px -12px ${glow}`,
        borderRadius: EV_R.lg,
        border: `1px solid ${EV_LINE}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg`}
          style={{ boxShadow: `0 4px 16px -4px ${glow}` }}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-[14px] font-bold leading-tight text-white">{label}</p>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: EV_MUTED }}>
            {sub}
          </p>
        </div>
      </div>
      <ChevronRight
        className="absolute bottom-2.5 right-2.5 h-4 w-4 text-white/25"
        strokeWidth={2.2}
        aria-hidden
      />
    </Link>
  );
}

/**
 * Écran « Live terminé » (post-session) — récap cours, suite d'apprentissage, Neuron, prochains lives.
 * `?session=` (optionnel) pour rattacher les futurs enchaînements métier (replay, résumé, etc.).
 */
export default function EleveLiveTermineScreen() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const sessionHint = search.get('session') || '';

  const onShare = useCallback(async () => {
    const path = sessionHint
      ? `${ELEVE_MOBILE.liveTermine}?session=${encodeURIComponent(sessionHint)}`
      : ELEVE_MOBILE.liveTermine;
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    const title = 'Live terminé';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: 'Cours suivi', url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  }, [sessionHint]);

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{ minHeight: '100dvh', backgroundColor: EV_BG, backgroundImage: PAGE_AMBIENT }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ELEVE_MOBILE.home))}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
              style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/90 transition active:scale-[0.99]"
              style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              Partage
            </button>
          </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
        <div className="relative mb-3 flex h-[120px] w-[120px] items-center justify-center">
          <ConfettiRing />
          <div
            className="relative z-10 flex h-[88px] w-[88px] items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(145deg, #d97757 0%, #d97757 50%, #7a3620 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 16px 40px -8px rgba(217, 119, 87, 0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <Check className="h-10 w-10 text-white" strokeWidth={3} />
          </div>
        </div>
        <h1 className="text-center text-[24px] font-extrabold tracking-tight text-white">Live terminé !</h1>
        <p className="mt-1.5 max-w-[20rem] text-center text-[14px] leading-relaxed" style={{ color: EV_MUTED }}>
          Bravo, tu as suivi le cours jusqu'au bout <span className="not-italic">🚀</span> À bientôt pour le prochain
          live !
        </p>
      </motion.div>

      <section
        className="mt-6 overflow-hidden p-4"
        style={{ background: EV_CARD, borderRadius: EV_R.lg, border: `1px solid ${EV_LINE}` }}
      >
        <div className="flex gap-3">
          <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-800 to-slate-900">
            <div className="absolute inset-0 flex items-end justify-center pb-1 text-2xl font-bold text-white/30">
              PM
            </div>
            <span
              className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white"
              style={{ background: EV_ACCENT }}
            >
              PROF
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: EV_ACCENT }}>
              Physique – Terminale S
            </p>
            <p className="mt-1 text-[16px] font-bold leading-tight text-white">Ondes et lumière – Chapitre 3</p>
            <p className="mt-0.5 text-[12px]" style={{ color: EV_MUTED }}>
              Interférences et diffraction
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className="h-6 w-6 shrink-0 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #d97757, #c96a4c)',
                }}
              />
              <span className="text-[13px] font-semibold text-white">Prof. Manikongo</span>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2.2} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-3.5 sm:flex-row sm:flex-wrap sm:gap-4">
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: EV_MUTED }}>
            <Users className="h-3.5 w-3.5 text-white/50" />
            <span>
              <span className="font-semibold text-white">128</span> élèves présents
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: EV_MUTED }}>
            <Clock className="h-3.5 w-3.5 text-white/50" />
            <span>
              <span className="font-semibold text-white">1h 28min</span> durée du live
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: EV_MUTED }}>
            <CalendarDays className="h-3.5 w-3.5 text-white/50" />
            Aujourd'hui · 10 mai 2024
          </p>
        </div>
      </section>

      <div className="mb-2 mt-7 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: 'rgba(217, 119, 87, 0.2)' }}
        >
          <BookOpen className="h-4 w-4" style={{ color: EV_ACCENT }} strokeWidth={2.2} />
        </span>
        <h2 className="text-[17px] font-bold text-white">Continue ton apprentissage</h2>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {LEARN_TILES.map((t) => (
          <LearningTile key={t.label} {...t} />
        ))}
      </div>

      <section
        className="mt-6 overflow-hidden p-4"
        style={{ background: EV_CARD, borderRadius: EV_R.lg, border: `1px solid ${EV_LINE}` }}
      >
        <h2 className="text-[16px] font-bold text-white">Ce que tu as appris aujourd'hui</h2>
        <div className="mt-3 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ul className="min-w-0 flex-1 space-y-2.5 text-[13px] leading-snug" style={{ color: EV_MUTED }}>
            {NOTIONS.map((n) => (
              <li key={n} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.4} />
                <span className="text-white/90">{n}</span>
              </li>
            ))}
            <li className="pl-6 text-[12px] font-semibold" style={{ color: EV_ACCENT }}>
              + 3 notions clés
            </li>
          </ul>
          <ChapterProgressRing pct={92} />
        </div>
      </section>

      <section
        className="mt-5 overflow-hidden p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 87, 0.12) 0%, rgba(17,13,10,0.95) 100%)',
          borderRadius: EV_R.lg,
          border: `1px solid ${EV_LINE}`,
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              background: 'linear-gradient(135deg, #d97757 0%, #7a3620 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
            }}
            aria-hidden
          >
            🧠
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-white">
              Neuron IA t'accompagne <span className="text-[10px] font-semibold text-orange-300">(BÊTA)</span>
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: EV_MUTED }}>
              Pose des questions sur le cours pour des explications personnalisées.
            </p>
          </div>
        </div>
        <Link
          to={ELEVE_MOBILE.neuron}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-bold text-white transition active:scale-[0.99]"
          style={{
            background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #a94f33 100%)`,
            boxShadow: EV_SH.cta,
          }}
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          Poser une question
        </Link>
      </section>

      <div className="mt-6">
        <EleveSectionTitle action="Voir tout" actionTo={ELEVE_MOBILE.live} actionClassName="!text-orange-400">
          Prochains lives
        </EleveSectionTitle>
        <div className="overflow-hidden p-3.5" style={{ background: EV_CARD, borderRadius: EV_R.lg, border: `1px solid ${EV_LINE}` }}>
          <div className="flex gap-3">
            <div
              className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 py-2 text-center"
              style={{ background: 'rgba(217, 119, 87, 0.1)' }}
            >
              <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: EV_ACCENT }}>
                Demain
              </span>
              <span className="mt-0.5 text-[11px] font-bold text-white">11 mai</span>
              <span className="text-[10px] font-semibold" style={{ color: EV_MUTED }}>
                16:00
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: EV_ACCENT }}>
                Physique – Terminale S
              </p>
              <p className="mt-0.5 text-[14px] font-bold text-white">Électromagnétisme – Chapitre 2</p>
              <p className="text-[12px] text-white/50">Prof. Manikongo</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full border-2"
                      style={{
                        borderColor: EV_BG,
                        background: `hsl(${(i + 3) * 50}, 45%, 40%)`,
                      }}
                    />
                  ))}
                  <span className="ml-3 self-center text-[11px] font-medium text-white/50">+86</span>
                </div>
                <Link
                  to={ELEVE_MOBILE.live}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold text-white"
                  style={{
                    background: `linear-gradient(90deg, ${EV_ACCENT}, #d97757)`,
                    boxShadow: '0 4px 14px -3px rgba(217, 119, 87, 0.5)',
                  }}
                >
                  <Star className="h-3.5 w-3.5" strokeWidth={2.2} />
                  S'inscrire
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

          <LiriPageFooterLine suffix="Live terminé" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
