import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Radio,
  BookOpen,
  MessageCircle,
  Monitor,
  ChevronRight,
  Users,
  Sparkles,
  Brain,
  GraduationCap,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/liri/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { useLiriMobileEnrollmentPreview } from '@/hooks/useLiriMobileEnrollmentPreview';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import { hasQuickAccessLiveSignal, hasQuickAccessLiveSoonSignal } from '@/lib/liveAlertSessionUi';
import { useLiriMobileAgendaMerged } from '@/hooks/useLiriMobileAgendaMerged';
import DashboardLiveSessionsPanel from '@/components/liri/live/DashboardLiveSessionsPanel';

function QuickTile({ to, icon: Icon, label, badge, badgeText, badgeTone = 'live', delay = 0 }) {
  const soon = badgeTone === 'soon';
  const agenda = badgeTone === 'agenda';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.28 }}>
      <Link
        to={to}
        className={cn(
          'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#D4AF37]/38 bg-gradient-to-b from-[#1a1612]/90 to-black/50 py-3 px-2',
          'shadow-[0_4px_20px_-8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(212,175,55,0.14)]',
          'active:scale-[0.96] transition-transform duration-150',
          badge &&
            !soon &&
            !agenda &&
            'ring-2 ring-[#ff3040]/50 shadow-[0_0_20px_-8px_rgba(255,48,64,0.5),0_4px_20px_-8px_rgba(0,0,0,0.8)]',
          badge && soon && 'ring-2 ring-amber-400/55 shadow-[0_0_18px_-8px_rgba(251,191,36,0.45),0_4px_20px_-8px_rgba(0,0,0,0.8)]',
          badge && agenda && 'ring-1 ring-[#D4AF37]/55 shadow-[0_0_18px_-8px_rgba(212,175,55,0.35),0_4px_20px_-8px_rgba(0,0,0,0.8)]',
        )}
      >
        {badge ? (
          <span
            className={cn(
              'absolute top-1 right-1 rounded-md px-1 py-0.5 text-[8px] font-bold leading-none shadow-lg',
              soon && 'animate-pulse bg-amber-500/95 text-black',
              agenda && 'bg-[#D4AF37]/92 text-black min-w-[1.1rem] text-center',
              !soon && !agenda && 'animate-pulse bg-[#ff3040] text-white shadow-[0_0_10px_rgba(255,48,64,0.65)]',
            )}
          >
            {badgeText || (soon ? 'Bientôt' : 'LIVE')}
          </span>
        ) : null}
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
          <Icon className="h-5 w-5 text-[#e8c547]" strokeWidth={1.85} />
        </span>
        <span className="text-[10px] font-semibold text-[#f0e6d4] text-center leading-tight">{label}</span>
      </Link>
    </motion.div>
  );
}

export default function MobileHomeScreen() {
  const { user } = useAuth();
  const liveAlertSessions = useLiveAlertsForUser(user?.id ?? null);
  const liveNow = hasQuickAccessLiveSignal(liveAlertSessions, user?.id ?? null);
  const liveSoon = Boolean(user?.id && !liveNow && hasQuickAccessLiveSoonSignal(liveAlertSessions, user.id));
  const { thisWeekCount: agendaWeekCount } = useLiriMobileAgendaMerged(user?.id);
  const firstName =
    user?.user_metadata?.full_name?.split?.(' ')?.[0] || user?.email?.split?.('@')?.[0] || null;
  const { currentFormation, loading: enrollLoading, progressLabel, progressPercent } = useLiriMobileEnrollmentPreview(
    user?.id,
  );

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto [scrollbar-width:thin] pb-4">
      <div className="pt-1 pb-3 shrink-0 flex items-start justify-between gap-3">
        <div>
          <LiriWordmark size="compact" className="text-[#D4AF37]" />
          <p className="mt-2 font-serif text-[1.35rem] leading-tight text-[#faf3e6] tracking-tight drop-shadow-[0_0_24px_rgba(212,175,55,0.12)]">
            {user ? `Bienvenue${firstName ? `, ${firstName}` : ''}` : 'Bienvenue'}
          </p>
          {user ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
              Connecté
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-white/45">Parcours membre · lives · cours</p>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
        <LiriGoldCard variant="hero" className="p-4 mb-4">
          <p className="font-serif text-lg text-[#fff8ed] tracking-tight">Reprendre le cours</p>
          {user && currentFormation && !enrollLoading ? (
            <>
              <p className="mt-1 text-sm text-white/70 line-clamp-2">{currentFormation.title}</p>
              {progressLabel ? (
                <p className="mt-2 text-[11px] text-[#D4AF37]/80">{progressLabel} · formations</p>
              ) : null}
              <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#b8860b] to-[#D4AF37] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <Link
                to="/classroom"
                className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-[#D4AF37]/55 bg-gradient-to-r from-[#D4AF37]/18 to-[#b8860b]/15 text-sm font-semibold text-[#fff4dc] shadow-[0_0_24px_-8px_rgba(212,175,55,0.35)] active:scale-[0.98] transition-transform"
              >
                Continuer
              </Link>
            </>
          ) : user && enrollLoading ? (
            <p className="mt-2 text-sm text-white/50">Chargement…</p>
          ) : user ? (
            <>
              <p className="mt-1 text-sm text-white/60">Explorez le catalogue ou ouvrez votre classe.</p>
              <Link
                to="/formations/catalogue"
                className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-sm font-semibold text-[#f5e6c8]"
              >
                Découvrir les formations
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-white/60">Connectez-vous pour suivre vos cours et lives.</p>
              <div className="mt-4 flex gap-2">
                <Link
                  to="/login"
                  className="flex-1 flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#c9a227] text-sm font-semibold text-black"
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  className="flex-1 flex h-11 items-center justify-center rounded-2xl border border-white/20 text-sm font-semibold text-white/90"
                >
                  S'inscrire
                </Link>
              </div>
            </>
          )}
        </LiriGoldCard>
      </motion.div>

      <LiriSectionLabel className="mb-2.5 text-white/40">Accès rapide</LiriSectionLabel>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <QuickTile
          to={LIRI_MOBILE.live}
          icon={Radio}
          label="Live"
          badge={liveNow || liveSoon}
          badgeText={liveNow ? 'LIVE' : 'Bientôt'}
          badgeTone={liveSoon ? 'soon' : 'live'}
          delay={0.05}
        />
        <QuickTile to={LIRI_MOBILE.courses} icon={BookOpen} label="Cours" delay={0.1} />
        <QuickTile to={user ? '/messages' : '/login'} icon={MessageCircle} label="Messages" delay={0.15} />
        <QuickTile to="/classroom" icon={Monitor} label="Classe" delay={0.2} />
      </div>
      <div className={cn('grid gap-2 mb-5', user ? 'grid-cols-3' : 'grid-cols-1')}>
        {user ? (
          <>
            <QuickTile to={LIRI_MOBILE.neuron} icon={Brain} label="Neuron" delay={0.22} />
            <QuickTile to={LIRI_MOBILE.postLive} icon={GraduationCap} label="Post-live" delay={0.24} />
          </>
        ) : null}
        <QuickTile
          to={LIRI_MOBILE.calendar}
          icon={CalendarDays}
          label="Agenda"
          badge={agendaWeekCount > 0}
          badgeText={agendaWeekCount > 99 ? '99+' : String(agendaWeekCount)}
          badgeTone="agenda"
          delay={user ? 0.26 : 0.22}
        />
      </div>

      {user ? (
        <div className="mb-5">
          <DashboardLiveSessionsPanel
            sessions={liveAlertSessions}
            className="border-[#D4AF37]/25 from-amber-950/40 via-[#15120f] to-[#0c0a08]"
          />
        </div>
      ) : null}

      <LiriSectionLabel className="mb-2.5 text-white/40">Communauté</LiriSectionLabel>
      <LiriGoldCard className="p-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10">
            <Users className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90">Lives & débats</p>
            <p className="text-[11px] text-white/45">Rejoindre la salle ou l'Arena</p>
          </div>
          <Link
            to={LIRI_MOBILE.arena}
            className="shrink-0 rounded-full border border-[#D4AF37]/50 px-3 py-1.5 text-[11px] font-semibold text-[#D4AF37]"
          >
            Arena
          </Link>
        </div>
      </LiriGoldCard>

      <Link
        to="/community"
        className="flex items-center justify-between rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-r from-white/[0.05] to-transparent px-4 py-3 text-sm text-[#ebe4d8] shadow-[inset_0_1px_0_rgba(212,175,55,0.08)] active:scale-[0.99] transition-transform"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          Communauté
        </span>
        <ChevronRight className="h-4 w-4 text-white/30" />
      </Link>

      <LiriPageFooterLine marginClass="mt-6" suffix="Prorascience" />
    </LiriMobileScreenShell>
  );
}
