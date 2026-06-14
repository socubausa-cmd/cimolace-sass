import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Flame,
  Trophy,
  Pencil,
  BarChart2,
  Download,
  Bookmark,
  Brain,
  Star,
  Target,
  GraduationCap,
  Building2,
  Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useLiriMobileEnrollmentPreview } from '@/hooks/useLiriMobileEnrollmentPreview';
import { useLiriStudentProgress } from '@/hooks/useLiriStudentProgress';
import { cn } from '@/lib/utils';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiveImmersiveModeProfileRow } from '@/components/eleve-mobile/LiveImmersiveModeProfileRow';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getLoginEntryPath } from '@/lib/loginEntryPath';
import { EV_BG, EV_MUTED, EV_LINE, EV_R } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';
/** Bordure avatar maquette */
const RING = '#7B61FF';

function profileHeroCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 20% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 55%)',
      'linear-gradient(180deg, rgba(20, 20, 34, 0.98) 0%, rgba(8, 8, 16, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 28px -10px rgba(0,0,0,0.5)',
  };
}

function globalProgressCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 0% 0%, rgba(124, 58, 237, 0.14) 0%, transparent 55%)',
      'linear-gradient(192deg, rgba(22, 24, 40, 0.98) 0%, rgba(10, 12, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 20px -8px rgba(79, 70, 229, 0.2)',
  };
}

function statPillStyle() {
  return {
    background: 'linear-gradient(180deg, rgba(20, 24, 32, 0.95) 0%, rgba(12, 14, 20, 0.98) 100%)',
    border: '1px solid rgba(165, 180, 252, 0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  };
}

function menuPanelSurface() {
  return {
    background: 'linear-gradient(195deg, rgba(18, 20, 32, 0.97) 0%, rgba(10, 10, 18, 0.99) 100%)',
    border: '1px solid rgba(165, 180, 252, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px -8px rgba(0,0,0,0.4)',
  };
}

function achievementCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 80% 60% at 30% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)',
      'linear-gradient(185deg, rgba(22, 24, 34, 0.96) 0%, rgba(12, 14, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  };
}

/** Calcule les badges débloqués depuis la progression réelle de l'élève. */
function computeAchievements(progress) {
  const badges = [];
  const { streak = 0, completedLessons = 0, totalTimeMinutes = 0, xp = 0 } = progress;

  if (streak >= 7)
    badges.push({
      id: 'streak7', tone: 'violet', top: String(streak), subIcon: 'stars',
      title: 'Semaine de feu 🔥', sub: `${streak} jours d'affilée`, xp: '15 XP',
      grad: 'from-violet-600 to-fuchsia-600',
    });
  else if (streak >= 3)
    badges.push({
      id: 'streak3', tone: 'violet', top: String(streak), subIcon: 'stars',
      title: 'En route 🚀', sub: `${streak} jours d'affilée`, xp: '5 XP',
      grad: 'from-violet-500 to-indigo-600',
    });

  if (completedLessons >= 10)
    badges.push({
      id: 'courses10', tone: 'emerald',
      top: <BookOpen className="h-4 w-4 text-white" strokeWidth={2.2} />, subIcon: null,
      title: 'Apprenti assidu', sub: `${completedLessons} cours terminés`, xp: '20 XP',
      grad: 'from-emerald-500 to-teal-600',
    });
  else if (completedLessons >= 1)
    badges.push({
      id: 'courses1', tone: 'emerald',
      top: <BookOpen className="h-4 w-4 text-white" strokeWidth={2.2} />, subIcon: null,
      title: 'Premier cours ✅', sub: `${completedLessons} cours terminé${completedLessons > 1 ? 's' : ''}`, xp: '10 XP',
      grad: 'from-emerald-500 to-cyan-600',
    });

  if (totalTimeMinutes >= 60)
    badges.push({
      id: 'time60', tone: 'blue',
      top: <Target className="h-4 w-4 text-white" strokeWidth={2.2} />, subIcon: null,
      title: 'Focus master', sub: `${Math.round(totalTimeMinutes / 60)}h de contenu`, xp: '15 XP',
      grad: 'from-sky-500 to-indigo-600',
    });

  if (xp >= 100)
    badges.push({
      id: 'xp100', tone: 'blue',
      top: <Star className="h-4 w-4 text-white" strokeWidth={2.2} />, subIcon: null,
      title: 'Cent XP', sub: `${xp} XP cumulés`, xp: '25 XP',
      grad: 'from-amber-500 to-orange-600',
    });

  return badges;
}

const MENU = [
  {
    to: '/settings',
    title: 'Informations personnelles',
    sub: 'Gère ton profil (ouvre le portail web)',
    icon: User,
    iconClass: 'text-violet-400',
  },
  {
    to: '/dashboard',
    title: 'Mes statistiques détaillées',
    sub: 'Ton évolution (ouvre le portail web)',
    icon: BarChart2,
    iconClass: 'text-emerald-400',
  },
  {
    to: ELEVE_MOBILE.bibliotheque,
    title: 'Téléchargements',
    sub: 'Cours, fiches et ressources téléchargés',
    icon: Download,
    iconClass: 'text-amber-400',
  },
  {
    to: ELEVE_MOBILE.modules,
    title: '21 modules',
    sub: 'Catalogue pédagogique et coaching',
    icon: BookOpen,
    iconClass: 'text-sky-400',
  },
  {
    to: ELEVE_MOBILE.forfaits,
    title: 'Forfaits',
    sub: 'Abonnement par cycle (mois, trimestre, année)',
    icon: Layers,
    iconClass: 'text-fuchsia-400',
  },
  {
    to: '/notebook',
    title: 'Mes notes',
    sub: 'Tes notes sauvegardées (ouvre le portail web)',
    icon: Bookmark,
    iconClass: 'text-sky-400',
  },
  {
    to: ELEVE_MOBILE.neuron,
    title: 'Neuron (mémoire IA)',
    sub: 'Ton assistant personnel intelligent',
    icon: Brain,
    iconClass: 'text-violet-400',
    badge: 'NOUVEAU',
  },
];

function ProfilHeader({ notificationCount }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <LiriWordmark size="kicker" className="text-white/40" />
        <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Profil</h1>
        <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
          Ton espace personnel
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Link
          to={ELEVE_MOBILE.notifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border text-white/90"
          style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {notificationCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-extrabold text-white"
              style={{ boxShadow: `0 0 0 2px ${EV_BG}` }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          ) : null}
        </Link>
        <Link
          to="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90"
          style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
          aria-label="Paramètres"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center rounded-xl px-1.5 py-3 text-center"
      style={statPillStyle()}
    >
      <span
        className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10"
        style={{ color }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <p className="text-[18px] font-extrabold leading-none tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[8.5px] font-semibold uppercase leading-tight tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function GlobalProgressBlock({ percent, completedCh, totalCh }) {
  const pct = Math.max(0, Math.min(100, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <Link
      to={ELEVE_MOBILE.bibliotheque}
      className="mb-5 block overflow-hidden p-3.5 active:opacity-95"
      style={{ borderRadius: EV_R.lg, ...globalProgressCardSurface() }}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-[86px] w-[86px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="url(#pf-ring)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
            />
            <defs>
              <linearGradient id="pf-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[20px] font-extrabold text-white">
            {Math.round(pct)}%
          </div>
        </div>
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[14px] font-bold leading-snug text-white">Très bon travail ! 🚀</p>
          <p className="mt-0.5 text-[12px] text-white/50">Tu es sur la bonne voie.</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/25" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #6D28D9 0%, #7C3AED 100%)',
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
        <span className="font-semibold" style={{ color: '#7C3AED' }}>
          {Math.round(pct)}% complété
        </span>
        <span className="text-white/45">
          {completedCh} / {totalCh} chapitres
        </span>
      </div>
    </Link>
  );
}

function MenuRow({ to, title, sub, icon: Icon, iconClass, badge }) {
  return (
    <Link to={to} className="block">
      <motion.div
        whileTap={{ scale: 0.995 }}
        className="flex items-center gap-4 px-5 py-4"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon className={cn('h-7 w-7', iconClass)} strokeWidth={1.85} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pr-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-white">{title}</p>
            {badge ? (
              <span className="inline-flex items-center rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[6.5px] font-extrabold uppercase leading-none tracking-wide text-white">
                {badge}
              </span>
            ) : null}
          </div>
          {sub ? (
            <p className="mt-1 text-[12px] leading-snug" style={{ color: EV_MUTED }}>
              {sub}
            </p>
          ) : null}
        </div>
        <ChevronRight
          className="h-[18px] w-[18px] shrink-0 opacity-90"
          style={{ color: '#9ca3af' }}
          strokeWidth={1.65}
          aria-hidden
        />
      </motion.div>
    </Link>
  );
}

export default function EleveProfileScreen() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { notifications: syncNotifications } = useDataSync();
  const { enrollments, loading: enrollLoading } = useLiriMobileEnrollmentPreview(user?.id);
  const progress = useLiriStudentProgress(user?.id);

  const unread = (Array.isArray(syncNotifications) ? syncNotifications : []).filter((n) => !n.isRead).length;

  const fullName = user?.user_metadata?.full_name || user?.email?.split?.('@')?.[0] || 'Élève';
  const displayName = fullName;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const schoolName = user?.user_metadata?.school || 'ISNA / PRORASCIENCE';
  const classLabel = user?.user_metadata?.class || 'Élève LIRI';

  const total = enrollments.length;
  const completedN = useMemo(
    () => enrollments.filter((e) => e?.status === 'completed').length,
    [enrollments],
  );

  // Données réelles depuis student_progress, démo si aucune donnée
  const hasReal = progress.hasRealData || total > 0;
  const statSuivis   = hasReal ? (progress.distinctCourses || total || 0) : 0;
  const statTerminés = hasReal ? (progress.completedLessons || completedN || 0) : 0;
  const statStreak   = hasReal ? progress.streak : 0;
  const statXp       = hasReal ? progress.xp : 0;

  const level   = hasReal ? progress.level : 1;
  const nextXp  = hasReal ? progress.nextLevelXp : 100;
  const chDone  = hasReal ? progress.completedLessons : 0;
  const chTotal = hasReal ? (progress.completedLessons + progress.inProgressLessons) || 1 : 1;
  // Badges calculés depuis la progression réelle
  const achievements = useMemo(() => computeAchievements({
    streak: statStreak,
    completedLessons: statTerminés,
    totalTimeMinutes: progress.totalTimeMinutes || 0,
    xp: statXp,
  }), [statStreak, statTerminés, progress.totalTimeMinutes, statXp]);

  const globalPct = useMemo(() => {
    if (!hasReal || chTotal <= 0) return 0;
    return Math.min(100, Math.round((chDone / chTotal) * 100));
  }, [hasReal, chDone, chTotal]);

  const initials = useMemo(() => {
    return String(fullName)
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [fullName]);

  const handleSignOut = async () => {
    try {
      if (typeof signOut === 'function') await signOut();
    } finally {
      navigate(getLoginEntryPath(), { replace: true });
    }
  };

  return (
    <EleveMobileShell user={user} notificationCount={unread} hideHeader contentClassName="!px-0">
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
        <div className="px-4 pb-4">
        <ProfilHeader notificationCount={unread} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-5 overflow-hidden p-3.5"
          style={{ borderRadius: EV_R.lg, ...profileHeroCardSurface() }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-6 h-32 w-32 rounded-full opacity-35 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.28) 0%, transparent 70%)' }}
          />
          <div className="relative flex min-w-0 items-stretch gap-2.5">
            <div className="flex min-h-0 min-w-0 flex-1 items-start gap-2.5 pr-0.5">
              <div className="relative shrink-0">
                <div
                  className="rounded-full p-[2.5px]"
                  style={{
                    background: `linear-gradient(145deg, ${RING}, #5c3ad6)`,
                    boxShadow: `0 0 0 1px ${RING}55, 0 0 20px -2px ${RING}99`,
                  }}
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#0B0B15] sm:h-[84px] sm:w-[84px]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[24px] font-bold text-white/90">{initials || 'É'}</span>
                    )}
                  </div>
                </div>
                <Link
                  to="/settings"
                  className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#0D0D14] text-white shadow-md"
                  aria-label="Modifier la photo"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-white">{displayName}</p>
                <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-violet-500/25 bg-[#1a0f2e] px-2 py-0.5 text-[9.5px] font-semibold text-violet-100">
                  <GraduationCap className="h-3 w-3 shrink-0 text-violet-200" strokeWidth={2.2} />
                  Élève
                </span>
                <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-white">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2} />
                  <span className="min-w-0 truncate">{schoolName}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-white/50">{classLabel}</p>
              </div>
            </div>

            <div
              className="flex w-[32%] max-w-[120px] min-w-0 shrink-0 flex-col justify-center rounded-2xl border border-violet-500/20 bg-[#12101a] px-1.5 py-2"
              style={{ boxShadow: 'inset 0 1px 0 rgba(123, 97, 255, 0.12)' }}
            >
              <p className="text-center text-[9px] font-medium text-white/45">Niveau</p>
              <div className="my-0.5 flex min-h-[2.5rem] items-end justify-center gap-0.5">
                <span className="text-[clamp(1.75rem,9vw,2.25rem)] font-extrabold leading-[0.85] text-white tabular-nums">
                  {level}
                </span>
                <span
                  className="mb-1.5 text-[12px] leading-none text-violet-400"
                  style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8)' }}
                  aria-hidden
                >
                  ✦
                </span>
              </div>
              <div className="mt-auto text-center">
                <p className="text-[8px] font-medium text-white/40">Prochain niveau</p>
                <p className="text-[11px] font-bold text-white">{nextXp} XP</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-5 flex gap-2">
          <StatPill icon={BookOpen} label="Cours suivis" value={statSuivis} color="#7C3AED" />
          <StatPill icon={CheckCircle2} label="Cours terminés" value={statTerminés} color="#22C55E" />
          <StatPill icon={Flame} label="Jours d'affilée" value={statStreak} color="#F97316" />
          <StatPill icon={Trophy} label="Points XP" value={statXp} color="#3B82F6" />
        </div>

        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">Ton progrès global</p>
        <GlobalProgressBlock percent={globalPct} completedCh={chDone} totalCh={chTotal} />

        <EleveSectionTitle action="Voir tout" actionTo={ELEVE_MOBILE.bibliotheque} className="mb-2" actionClassName="!text-[#7C3AED]">
          Réalisations récentes
        </EleveSectionTitle>

        {achievements.length === 0 ? (
          <div className="mb-6 rounded-xl border border-white/[0.08] px-4 py-5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Trophy className="mx-auto mb-2 h-6 w-6 text-violet-400/40" strokeWidth={1.8} />
            <p className="text-[12.5px] font-medium" style={{ color: EV_MUTED }}>
              Termine ton premier cours pour débloquer des réalisations.
            </p>
          </div>
        ) : (
        <div className="-mx-1 mb-6 flex touch-pan-x snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pl-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="w-[min(9.5rem,42vw)] shrink-0 snap-center p-3"
              style={{ borderRadius: EV_R.lg, ...achievementCardSurface() }}
            >
              <div
                className={cn(
                  'mb-2 flex h-12 w-12 items-center justify-center bg-gradient-to-br text-lg font-extrabold text-white',
                  a.grad,
                )}
                style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)' }}
              >
                {a.subIcon === 'stars' ? (
                  <div className="flex flex-col items-center leading-none">
                    <span>7</span>
                    <Star className="mt-0.5 h-2.5 w-2.5 fill-amber-200 text-amber-200" />
                  </div>
                ) : (
                  a.top
                )}
              </div>
              <p className="line-clamp-2 text-[12.5px] font-bold leading-tight text-white">{a.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-white/45">{a.sub}</p>
              <p
                className="mt-2 text-[10.5px] font-extrabold"
                style={{
                  color: a.tone === 'violet' ? '#A78BFA' : a.tone === 'emerald' ? '#34D399' : '#38BDF8',
                }}
              >
                {a.xp}
              </p>
            </div>
          ))}
        </div>
        )}

        <div
          className="mb-2 overflow-hidden rounded-2xl"
          style={menuPanelSurface()}
        >
          <div className="divide-y divide-white/[0.1]">
            <LiveImmersiveModeProfileRow />
            {MENU.map((row) => (
              <MenuRow key={row.title} {...row} />
            ))}
          </div>
        </div>

        {user ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] py-3.5 text-[14px] font-medium text-rose-300/90 transition-transform active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        ) : null}

        <LiriPageFooterLine suffix="Profil élève" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
