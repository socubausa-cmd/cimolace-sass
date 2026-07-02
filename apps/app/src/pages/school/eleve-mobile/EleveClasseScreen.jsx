import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Megaphone, Users, Folder, BarChart2, Play, ArrowLeft, CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useTenantContext } from '@/hooks/useTenantModules';
import { useLiriClasseMembers } from '@/hooks/useLiriClasseMembers';
import { useLiriClasseAnnonces } from '@/hooks/useLiriClasseAnnonces';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
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
} from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const HERO =
  'linear-gradient(140deg, #1c120c 0%, #7a3620 28%, #a94f33 45%, #d97757 58%, #3a2418 100%)';

/** Halos légèrement différenciés par tuile (Lun.– style cases agenda). */
const ACTION_TILE_HALO = [
  'rgba(201, 106, 76, 0.16)',
  'rgba(226, 133, 79, 0.16)',
  'rgba(245, 158, 11, 0.14)',
  'rgba(16, 185, 129, 0.15)',
];

function actionTileStyle(index) {
  const h = ACTION_TILE_HALO[index] ?? ACTION_TILE_HALO[0];
  return {
    background: [
      `radial-gradient(ellipse 100% 80% at 50% 0%, ${h} 0%, transparent 58%)`,
      'linear-gradient(192deg, rgba(26,21,15,0.97) 0%, rgba(15,11,9,0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.2)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px -4px rgba(28,20,14,0.5)',
  };
}

function annonceCardStyle() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 12% 0%, rgba(217, 119, 87, 0.12) 0%, transparent 55%)',
      'linear-gradient(188deg, rgba(24,20,15,0.98) 0%, rgba(15,12,10,0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px -3px rgba(0,0,0,0.4)',
  };
}

function sondageCardStyle() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(16, 185, 129, 0.12) 0%, transparent 58%)',
      'linear-gradient(190deg, rgba(22,18,13,0.98) 0%, rgba(14,12,9,0.99) 100%)',
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
    badge: null,
    iconRing: 'border-orange-500/30 bg-orange-500/15',
    iconColor: 'text-orange-200',
  },
  {
    to: `${ELEVE_MOBILE.classe}#membres`,
    icon: Users,
    label: 'Membres',
    iconRing: 'border-amber-500/30 bg-amber-500/12',
    iconColor: 'text-amber-200',
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

/** Couleurs de gradient pour les avatars membres (cycle) */
const AVATAR_GRADIENTS = [
  'from-amber-400 to-rose-500',
  'from-amber-400 to-amber-500',
  'from-emerald-400 to-amber-500',
  'from-rose-400 to-orange-600',
  'from-orange-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-lime-400 to-emerald-500',
  'from-orange-400 to-amber-600',
];

/** Mappe un tone d'annonce vers les classes CSS Tailwind */
function toneToTagC(tone) {
  if (tone === 'violet')
    return { bg: 'bg-orange-500/18', t: 'text-orange-200', border: 'border border-orange-500/30' };
  return { bg: 'bg-amber-500/15', t: 'text-amber-200', border: 'border border-amber-500/25' };
}

function CapBooksArt() {
  return (
    <svg viewBox="0 0 120 100" className="h-[88px] w-[104px] shrink-0 drop-shadow-[0_12px_28px_rgba(217, 119, 87,0.35)]" aria-hidden>
      <defs>
        <linearGradient id="cl-cap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eab89a" />
          <stop offset="1" stopColor="#a94f33" />
        </linearGradient>
        <linearGradient id="cl-bk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d97757" />
          <stop offset="1" stopColor="#7a3620" />
        </linearGradient>
      </defs>
      <rect x="18" y="55" width="24" height="32" rx="2" fill="url(#cl-bk)" opacity="0.95" />
      <rect x="48" y="48" width="24" height="40" rx="2" fill="url(#cl-cap)" />
      <rect x="78" y="60" width="20" height="28" rx="2" fill="#7a3620" />
      <path d="M58 28 L40 38 L40 50 L60 50 L60 32 Z" fill="url(#cl-cap)" />
      <ellipse cx="50" cy="32" rx="20" ry="4.5" fill="#0b0a08" opacity="0.25" />
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
            color: '#0b0b0a',
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
  const { tenant } = useTenantContext();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  // Tenant ID for queries
  const tenantId = tenant?.tenant_id ?? tenant?.id ?? null;

  // Real data hooks
  const { members, total: membersTotal, loading: membersLoading } = useLiriClasseMembers({ tenantId, limit: 7 });
  const { annonces, loading: annoncesLoading } = useLiriClasseAnnonces({ tenantId, userId: user?.id, limit: 4 });

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
          backgroundImage: 'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.14), transparent 70%)',
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
                  : `${tenant?.name ?? 'ISNA'} · espace de classe`}
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
                  background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #a94f33 100%)`,
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
            borderColor: 'rgba(217, 119, 87, 0.3)',
            boxShadow: EV_SH.hero,
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-50 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(235, 200, 170, 0.35) 0%, transparent 70%)' }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[20px] font-extrabold leading-tight text-white">
                {tenant?.name ?? 'ISNA'}
              </p>
              <p className="mt-1 text-[12.5px] text-orange-100/90">
                {membersLoading ? '…' : `${membersTotal} membre${membersTotal !== 1 ? 's' : ''} actif${membersTotal !== 1 ? 's' : ''}`}
              </p>
            </div>
            <CapBooksArt />
          </div>
        </motion.div>

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          {TILES.map((t, i) => (
            <ActionTile
              key={t.label}
              {...t}
              index={i}
              badge={t.label === 'Annonces' && annonces.length > 0 ? annonces.length : t.badge}
            />
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
          actionTo={ELEVE_MOBILE.communaute}
          className="mb-2.5"
          actionClassName="!text-orange-400/95"
        >
          Annonces récentes
        </EleveSectionTitle>
        <div className="mb-6 space-y-2.5">
          {annoncesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400/50" />
            </div>
          ) : annonces.length === 0 ? (
            <div className="py-3 px-3.5 text-[12.5px]" style={{ color: EV_MUTED }}>
              Aucune annonce pour l'instant. Les annonces de l\'école apparaîtront ici.
            </div>
          ) : annonces.map((a, i) => {
            const tagC = toneToTagC(a.tagTone);
            return (
              <div
                key={a.id ?? i}
                className="p-3.5"
                style={{ borderRadius: EV_R.md, ...annonceCardStyle() }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10"
                    style={{ background: 'linear-gradient(135deg, #c96a4c, #c96a4c)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-white">{a.who}</p>
                      <span className="shrink-0 text-[10.5px]" style={{ color: EV_MUTED }}>
                        {a.time}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'mt-1.5 inline-block rounded-md px-2 py-0.5 text-[7.5px] font-extrabold tracking-wide',
                        tagC.bg, tagC.t, tagC.border,
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
            );
          })}
        </div>
        </div>

        <p id="membres" className="mb-2.5 scroll-mt-6 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/45">
          Membres · {membersLoading ? '…' : membersTotal}
        </p>
        <div className="flex max-w-full items-center gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {membersLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-400/50" />
          ) : members.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: EV_MUTED }}>Aucun membre pour l'instant.</p>
          ) : (
            <>
              {members.map((m, idx) => (
                <div key={m.id} className="flex shrink-0 flex-col items-center gap-1">
                  <div
                    className={cn('h-11 w-11 rounded-full bg-gradient-to-br p-0.5', AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length])}
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0b0b0a] text-[10px] font-bold text-white/90">
                        {m.initials}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[3.5rem] truncate text-[10px]" style={{ color: EV_MUTED }}>
                    {m.name.split(' ')[0]}
                  </span>
                </div>
              ))}
              {membersTotal > members.length && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.45)' }}
                  >
                    +{membersTotal - members.length}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: EV_MUTED }}>Autres</span>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
