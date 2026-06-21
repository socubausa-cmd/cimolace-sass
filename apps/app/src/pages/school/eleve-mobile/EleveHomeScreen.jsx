import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Radio,
  BookOpen,
  MessageCircle,
  Users,
  CalendarDays,
  ChevronRight,
  Play,
  ShieldCheck,
  BadgeCheck,
  PlayCircle,
  School,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
  EleveMobileShell,
  EleveSectionTitle,
  QuickTile,
  EleveInfoBanner,
  EleveEmptyState,
} from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import {
  EV_BG,
  EV_MUTED,
  EV_ACCENT,
  EV_LINE,
  EV_R,
  EV_SH,
  EV_PAGE_AMBIENT,
} from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import { useLiveSessionActiveParticipantCount } from '@/hooks/useLiveSessionActiveParticipantCount';
import { useLiriMobileAgendaMerged } from '@/hooks/useLiriMobileAgendaMerged';
import { useLiriMobileEnrollmentPreview } from '@/hooks/useLiriMobileEnrollmentPreview';
import { formatDistanceToNow } from 'date-fns';
import { fr as frDateFns } from 'date-fns/locale';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';
import {
  hasQuickAccessLiveSoonSignal,
  pickQuickAccessLiveSession,
  liveSessionPrimaryHref,
  liveSessionPrimaryCtaLabel,
  isExternalLiveHref,
  isHomeOnAirSession,
  orderHomeLiveSessions,
} from '@/lib/liveAlertSessionUi';
import { cn } from '@/lib/utils';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';

/**
 * Gris secondaire de l'accueil — plus clair que `EV_MUTED` (#8E8E93) pour remonter le
 * contraste du texte secondaire sur fond #0B0B0F (≈ 4.7:1 → ≈ 7:1, lisible). Local à cet
 * écran ; on ne touche pas le token partagé `EV_MUTED`.
 */
const EV_MUTED_HOME = '#B9B9C2';

function homeHeroCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 20% 0%, rgba(99, 102, 241, 0.14) 0%, transparent 55%)',
      'linear-gradient(180deg, rgba(20, 20, 34, 0.98) 0%, rgba(8, 8, 16, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 28px -10px rgba(0,0,0,0.5)',
  };
}

/* ------------------------------------------------------------------ */
/*  Hero — maquette d'accueil (dégradé + pile livres + CTA blanc)      */
/* ------------------------------------------------------------------ */

function HelloHero({ firstName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-6 overflow-hidden p-3.5 sm:p-4"
      style={{ borderRadius: EV_R.lg, ...homeHeroCardSurface() }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, transparent 70%)' }}
      />
      <div className="relative flex items-stretch gap-1">
        <div className="min-w-0 max-w-[62%] flex-1">
          <p className="text-[20px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[22px]">
            Bonjour, {firstName || 'ÉLÈVE'} ! <span className="inline-block">👋</span>
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.45] sm:text-[13px]" style={{ color: '#D6D6DE' }}>
            Prêt à apprendre aujourd&apos;hui ? Continue ton parcours et rejoins ton prochain live.
          </p>
          <Link
            to={ELEVE_MOBILE.vieScolaire}
            className="mt-3.5 inline-flex h-11 min-h-[44px] items-center justify-center gap-0.5 rounded-[20px] bg-white px-4 text-[13px] font-bold text-[#5B3CC4] shadow-[0_8px_24px_-6px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.98]"
          >
            Vie scolaire
            <ChevronRight className="h-4 w-4 text-[#5B3CC4]" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="flex shrink-0 items-end" style={{ width: 120 }}>
          <GraduationIllustration />
        </div>
      </div>
    </motion.div>
  );
}

function GraduationIllustration() {
  return (
    <svg
      viewBox="0 0 140 150"
      width="100%"
      height="148"
      className="max-h-[148px] drop-shadow-[0_10px_28px_rgba(168,85,247,0.5)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="ev-bookA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#5b3dcf" />
        </linearGradient>
        <linearGradient id="ev-bookB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b8def" />
          <stop offset="100%" stopColor="#3a5ec4" />
        </linearGradient>
        <linearGradient id="ev-bookC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="ev-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1d2e" />
          <stop offset="100%" stopColor="#0a0c1a" />
        </linearGradient>
        <radialGradient id="ev-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(168,85,247,0.45)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="70" cy="118" rx="58" ry="12" fill="url(#ev-halo)" />
      <g fill="#fff" opacity="0.9">
        <path d="M20 18 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" />
        <path d="M115 30 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z" />
      </g>
      <rect x="30" y="100" width="80" height="14" rx="2" fill="url(#ev-bookA)" />
      <rect x="30" y="100" width="5" height="14" fill="rgba(255,255,255,0.2)" />
      <rect x="34" y="86" width="80" height="14" rx="2" fill="url(#ev-bookB)" />
      <rect x="34" y="86" width="5" height="14" fill="rgba(255,255,255,0.16)" />
      <rect x="28" y="72" width="80" height="14" rx="2" fill="url(#ev-bookC)" />
      <rect x="28" y="72" width="5" height="14" fill="rgba(255,255,255,0.18)" />
      <rect x="95" y="86" width="6" height="22" fill="#fbbf24" />
      <polygon points="95,108 98,104 101,108" fill="#fbbf24" />
      <ellipse cx="68" cy="65" rx="32" ry="6" fill="url(#ev-cap)" />
      <polygon points="36,65 68,52 100,65 68,78" fill="url(#ev-cap)" />
      <path
        d="M100 65 L102 56 Q104 54 106 56 L108 60 Q108 65 105 67 Z"
        fill="#fbbf24"
      />
      <circle cx="105" cy="67" r="3" fill="#fbbf24" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Carte « Live en cours » — données `useLiveAlertsForUser` + profil hôte  */
/* ------------------------------------------------------------------ */

function useProfileBrief(userId) {
  const [state, setState] = useState({ name: null, avatar_url: null, role: null, profileLoaded: !userId });
  useEffect(() => {
    if (!userId) {
      setState({ name: null, avatar_url: null, role: null, profileLoaded: true });
      return;
    }
    setState({ name: null, avatar_url: null, role: null, profileLoaded: false });
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, avatar_url, role')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setState({ name: null, avatar_url: null, role: null, profileLoaded: true });
        return;
      }
      setState({
        name: data.name,
        avatar_url: data.avatar_url,
        role: data.role ?? null,
        profileLoaded: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return state;
}

function profLabelFromName(name) {
  if (!name || !String(name).trim()) return 'Prof.';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return `Prof. ${parts[0]}`;
  return `Prof. ${parts[parts.length - 1]}`;
}

function profInitials(name) {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || '?';
}

/** CTA maquette LIRI — aligné `EV_ACCENT` */
function LiveJoinCta({ href, children, className: outerClassName }) {
  const className = cn(
    'relative flex h-[44px] w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-[12px] px-2 text-[13px] font-bold leading-tight text-white transition-transform active:scale-[0.99]',
    outerClassName,
  );
  const style = {
    background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #3b41de 100%)`,
    boxShadow: `${EV_SH.cta}, inset 0 1px 0 rgba(255,255,255,0.18)`,
  };
  if (isExternalLiveHref(href)) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={href || ELEVE_MOBILE.live} className={className} style={style}>
      {children}
    </Link>
  );
}

function formatSessionScheduleLabel(scheduledAt) {
  if (!scheduledAt) return '';
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Aujourd'hui · ${t}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Demain · ${t}`;
  return (
    d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${t}`
  );
}

function LiveThumb({ coverUrl, title, upcoming }) {
  return (
    <div className="relative h-[96px] w-[112px] shrink-0 overflow-hidden rounded-[12px] border border-white/10">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #1a1e2a 0%, #0b0e14 100%)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(50% 50% at 50% 40%, rgba(124,92,255,0.3), transparent 75%)',
            }}
          />
          <svg viewBox="0 0 110 90" className="absolute inset-0 h-full w-full opacity-80" aria-hidden>
            <title>{title || 'Live'}</title>
            <circle cx="55" cy="36" r="15" fill="#4a3d32" />
            <ellipse cx="55" cy="68" rx="24" ry="16" fill="#1e3d2e" />
            <circle cx="55" cy="36" r="10" fill="#6b5340" />
          </svg>
        </>
      )}
      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65">
        {upcoming ? (
          <CalendarDays className="h-2.5 w-2.5 text-white" />
        ) : (
          <Radio className="h-2.5 w-2.5 text-white" />
        )}
      </span>
    </div>
  );
}

function LiveNowCard({ session, viewerUserId, isUpcoming, className: wrapClassName }) {
  const { name: hostName, avatar_url: hostAvatar } = useProfileBrief(session?.teacher_id);
  const isArena = Boolean(session && session.source !== 'immersive');
  const onAir = session ? isHomeOnAirSession(session, viewerUserId) : false;
  const { count: participantCount } = useLiveSessionActiveParticipantCount(
    isArena && session ? session.id : null,
    { enabled: isArena && Boolean(session) && onAir },
  );
  const href = session ? liveSessionPrimaryHref(session, viewerUserId) : ELEVE_MOBILE.live;
  const ctaRaw = session
    ? liveSessionPrimaryCtaLabel(session, viewerUserId)
    : 'Voir les lives';
  /** Maquette : libellé principal « Rejoindre le live » (évite « Rejoindre maintenant » trop générique). */
  const cta =
    ctaRaw === 'Rejoindre maintenant' && session && session.source !== 'immersive'
      ? 'Rejoindre le live'
      : ctaRaw;

  const line1 = useMemo(() => {
    if (!session) return '—';
    return session.title || 'Cours en direct';
  }, [session]);

  const showAsUpcoming = Boolean(session && (isUpcoming === true || (!onAir && String(session.status || '').toLowerCase() === 'scheduled')));

  const line2 = useMemo(() => {
    if (!session) return '';
    if (showAsUpcoming) {
      if (session.description && String(session.description).trim()) return String(session.description).trim();
      if (session.source === 'invited') return "Tu es invité(e) à ce direct";
      if (session.source === 'waiting_approval') return "File d'attente — rejoins avant l'heure";
      return 'Session programmée';
    }
    if (session.description && String(session.description).trim()) return String(session.description).trim();
    if (session.source === 'waiting_approval') return "Tu es en salle d'attente";
    if (session.source === 'immersive') return 'Appel vidéo messagerie';
    if (session.source === 'public') return 'Visibilité publique';
    if (session.source === 'invited') return 'Tu es invité(e) à ce direct';
    return 'Session en direct';
  }, [session, showAsUpcoming]);

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <EleveEmptyState
          icon={Radio}
          title="Aucun live en direct pour l'instant"
          description="Quand un cours est lancé, il apparaîtra ici."
          primary={{ to: ELEVE_MOBILE.live, label: "Ouvrir l'espace Live", variant: 'ghost' }}
        />
      </motion.div>
    );
  }

  const prof = profLabelFromName(hostName);
  const initials = profInitials(hostName);

  const frameStyle = showAsUpcoming
    ? {
        background:
          'linear-gradient(135deg, rgba(90, 120, 220, 0.55) 0%, rgba(20, 22, 40, 0.45) 50%, rgba(80, 100, 255, 0.5) 100%)',
        boxShadow:
          '0 0 0 1px rgba(91, 141, 239, 0.2), 0 20px 48px -24px rgba(0,0,0,0.7), 0 0 40px -12px rgba(60, 80, 200, 0.12)',
      }
    : {
        background:
          'linear-gradient(135deg, rgba(100, 90, 180, 0.55) 0%, rgba(20, 22, 40, 0.45) 40%, rgba(255, 77, 77, 0.65) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255, 77, 77, 0.15), 0 20px 48px -24px rgba(0,0,0,0.7), 0 0 40px -12px rgba(255, 60, 80, 0.15)',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn('relative overflow-hidden rounded-[22px] p-px', wrapClassName ?? 'mb-6')}
      style={frameStyle}
    >
      <div
        className="relative overflow-hidden rounded-[21px] bg-[#0a0a0c] px-4 py-4"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {showAsUpcoming ? (
                <>
                  <span
                    className="inline-flex h-[20px] items-center rounded-[5px] px-2 text-[8px] font-extrabold leading-none tracking-[0.1em] text-white"
                    style={{ background: 'linear-gradient(90deg, #3b4ede 0%, #5b8def 100%)' }}
                  >
                    PROCHAIN
                  </span>
                  <span
                    className="text-[9.5px] font-extrabold uppercase leading-none tracking-[0.18em] text-[#4A90E2]"
                    style={{ textShadow: '0 0 16px rgba(91, 141, 239, 0.25)' }}
                  >
                    {formatSessionScheduleLabel(session.scheduled_at) || 'BIENTÔT'}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-[20px] items-center rounded-[5px] bg-[#ff4d4d] px-2 text-[8px] font-extrabold leading-none tracking-[0.1em] text-white">
                    LIVE
                  </span>
                  <span
                    className="text-[9.5px] font-extrabold uppercase leading-none tracking-[0.2em] text-[#ff4d4d]"
                    style={{ textShadow: '0 0 20px rgba(255, 77, 77, 0.35)' }}
                  >
                    EN DIRECT
                  </span>
                </>
              )}
            </div>

            <p className="mt-3 text-[16px] font-extrabold leading-[1.2] tracking-[-0.01em] text-white">{line1}</p>
            {line2 ? (
              <p className="mt-1.5 line-clamp-2 text-[12.5px] font-normal leading-snug text-white/90">{line2}</p>
            ) : null}

            <div className="mt-2.5 flex min-w-0 items-center gap-1.5">
              {hostAvatar ? (
                <img
                  src={hostAvatar}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                  style={{
                    background: 'linear-gradient(145deg, #4a6cff, #5b8def)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
                  }}
                >
                  {initials}
                </div>
              )}
              <span className="min-w-0 truncate text-[12px] font-medium text-white">{prof}</span>
              {hostName ? (
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(145deg, #7c3aed, #5b21b6)' }}
                  title="Hôte vérifié"
                >
                  <BadgeCheck className="h-2.5 w-2.5 text-white" aria-hidden strokeWidth={2.4} />
                </span>
              ) : null}
            </div>

            <div className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/35 px-2 py-1">
              {showAsUpcoming ? (
                <CalendarDays className="h-3 w-3 shrink-0 text-white" strokeWidth={2.2} />
              ) : (
                <Users className="h-3 w-3 shrink-0 text-white" strokeWidth={2.2} />
              )}
              <span className="text-[10.5px] font-semibold leading-none text-[#2ecc71]">
                {showAsUpcoming
                  ? 'Dans les 48 h — pense à te connecter'
                  : session.source === 'immersive'
                    ? 'Appel en cours'
                    : participantCount != null && participantCount > 0
                      ? participantCount === 1
                        ? '1 élève connecté'
                        : `${participantCount} élèves connectés`
                      : 'Salle ouverte'}
              </span>
            </div>
          </div>

          <div className="flex w-[112px] shrink-0 flex-col items-stretch gap-2.5 self-start">
            <LiveThumb coverUrl={session.cover_image_url} title={line1} upcoming={showAsUpcoming} />
            <LiveJoinCta
              href={href}
              className="!h-11 !justify-between !gap-1.5 !px-2 !text-[11px] !leading-tight"
            >
              <span className="min-w-0 flex-1 text-left font-bold leading-tight [text-wrap:balance]">{cta}</span>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Play className="h-2.5 w-2.5 fill-white text-white" />
              </span>
            </LiveJoinCta>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Liste « À venir »                                                */
/* ------------------------------------------------------------------ */

function UpcomingItem({ icon: Icon, accent, when, title, sub, prof, profInitial, in_, to }) {
  const palettes = {
    blue: { from: '#3B6FE8', to: '#5B8DEF', soft: 'rgba(91,141,239,0.2)', when: '#5B8DEF' },
    purple: { from: '#9333EA', to: '#A855F7', soft: 'rgba(168,85,247,0.2)', when: '#C084FC' },
  };
  const p = palettes[accent] || palettes.blue;
  return (
    <Link to={to || '#'} className="mb-2.5 block">
      <motion.div
        whileTap={{ scale: 0.99 }}
        className="flex items-center gap-3 p-3"
        style={{
          borderRadius: EV_R.lg,
          background: [
            `radial-gradient(ellipse 100% 80% at 0% 0%, ${p.soft} 0%, transparent 58%)`,
            'linear-gradient(195deg, rgba(22, 24, 40, 0.97) 0%, rgba(10, 12, 24, 0.99) 100%)',
          ].join(', '),
          border: '1px solid rgba(165, 180, 252, 0.16)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px -4px rgba(0,0,0,0.35)',
        }}
      >
        <div
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(140deg, ${p.from} 0%, ${p.to} 100%)`,
            boxShadow: `0 8px 20px -8px ${p.soft}`,
          }}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold" style={{ color: p.when }}>
            {when}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-white">{title}</p>
          <p className="truncate text-[11.5px]" style={{ color: EV_MUTED_HOME }}>
            {sub}
          </p>
          {prof ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[6.5px] font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}
              >
                {profInitial || prof[0]}
              </span>
              <span className="text-[10.5px]" style={{ color: EV_MUTED_HOME }}>
                {prof}
              </span>
            </div>
          ) : null}
        </div>
        {in_ ? (
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
            style={{ background: p.soft, color: p.when, borderColor: `${p.from}50` }}
          >
            {in_}
          </span>
        ) : null}
      </motion.div>
    </Link>
  );
}

function agendaEventSubline(ev) {
  const loc = (ev?.location && String(ev.location).trim()) || '';
  if (loc) return loc;
  const desc = (ev?.description && String(ev.description).trim()) || '';
  if (desc) return desc.length > 100 ? `${desc.slice(0, 100)}…` : desc;
  switch (ev?.type) {
    case 'formation_live':
      return 'Live formation';
    case 'live':
      return 'Session live';
    case 'appointment':
      return 'Rendez-vous';
    case 'school':
      return 'Vie scolaire';
    case 'calendar':
      return 'Planning pédagogique';
    case 'exam':
      return 'Évaluation';
    default:
      return 'Détail dans l\'agenda';
  }
}

function agendaItemHref(ev) {
  if (ev?.href && String(ev.href).trim()) return String(ev.href).trim();
  return ELEVE_MOBILE.agenda;
}

function liriAccessInfoBannerModel({ role, formationTitle, enrollCount, profileLoaded, enrollLoading }) {
  const r = String(role || '').toLowerCase();
  const dataPending = enrollLoading || !profileLoaded;
  if (dataPending) {
    return {
      title: 'Espace LIRI',
      description: 'Chargement de ton profil et de tes inscriptions…',
      accent: 'blue',
      to: null,
    };
  }
  if (r === 'visitor') {
    return {
      title: 'Accès visiteur',
      description: formationTitle
        ? `Découverte. Parcours suivi côté école : ${formationTitle}. L'enseignement complet (lives, déblocage des modules) passe par un forfait ou le secrétariat.`
        : 'Espace de découverte. Pour l\'enseignement complet, inscris-toi à un parcours, choisis un forfait, ou contacte le secrétariat.',
      accent: 'purple',
      to: ELEVE_MOBILE.forfaits,
    };
  }
  if (formationTitle) {
    const many = typeof enrollCount === 'number' && enrollCount > 1 ? ` — ${enrollCount} inscriptions liées à ton compte.` : '';
    return {
      title: `Tes inscriptions (${isnaTenantConfig.branding.name})`,
      description: `L'agenda, les annonces de lives et la bibliothèque s'appuient sur le parcours « ${formationTitle} »${many}`,
      accent: 'green',
      to: ELEVE_MOBILE.bibliotheque,
    };
  }
  if (r === 'student' || r === 'owner' || r === 'admin' || r === 'secretariat' || r === 'teacher' || r === 'coach' || r === 'mentor') {
    return {
      title: r === 'student' ? 'Compte élève' : 'Compte LIRI',
      description: 'Aucun parcours inscrit pour l\'instant. Ouvre le catalogue de modules et les forfaits pour activer l\'accès côté école (secrétariat, paiement, validation).',
      accent: 'blue',
      to: ELEVE_MOBILE.modules,
    };
  }
  return {
    title: 'Espace LIRI',
    description: 'Tes contenus ici dépendent des inscriptions gérées par l\'école. En cas de doute, le secrétariat fait le lien avec le back office.',
    accent: 'blue',
    to: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Écran principal                                                   */
/* ------------------------------------------------------------------ */

export default function EleveHomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { name: studentNameFromProfile, role: studentProfileRole, profileLoaded: profileInfoLoaded } =
    useProfileBrief(user?.id ?? null);
  const { enrollments: enrollmentRows, loading: enrollLoading, currentFormation } = useLiriMobileEnrollmentPreview(
    user?.id,
  );
  const { events: agendaEvents, loading: agendaLoading } = useLiriMobileAgendaMerged(user?.id);
  const { notifications: syncNotifications } = useDataSync();
  const liveAlertSessions = useLiveAlertsForUser(user?.id ?? null);
  const homeLiveSessions = useMemo(
    () => orderHomeLiveSessions(liveAlertSessions, user?.id ?? null),
    [liveAlertSessions, user?.id],
  );
  const featuredLive = useMemo(
    () => pickQuickAccessLiveSession(liveAlertSessions, user?.id ?? null),
    [liveAlertSessions, user?.id],
  );
  const liveNow = Boolean(featuredLive);
  const liveSoon = Boolean(
    user?.id && !liveNow && hasQuickAccessLiveSoonSignal(liveAlertSessions, user.id),
  );
  const unreadInbox = (Array.isArray(syncNotifications) ? syncNotifications : []).filter((n) => !n.isRead)
    .length;
  const upcomingFromAgenda = useMemo(() => {
    const now = Date.now();
    return (agendaEvents || [])
      .filter((ev) => {
        const t = new Date(ev?.startAt).getTime();
        return !Number.isNaN(t) && t >= now - 60_000;
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 2);
  }, [agendaEvents]);

  const firstName = useMemo(() => {
    const fromProfile = studentNameFromProfile && String(studentNameFromProfile).trim()
      ? String(studentNameFromProfile).trim().split(/\s+/)?.[0]?.toUpperCase()
      : '';
    if (fromProfile) return fromProfile;
    return (
      user?.user_metadata?.full_name?.split?.(' ')?.[0]?.toUpperCase() ||
      user?.email?.split?.('@')?.[0]?.toUpperCase() ||
      'ÉLÈVE'
    );
  }, [studentNameFromProfile, user]);

  const accessInfo = useMemo(
    () =>
      liriAccessInfoBannerModel({
        role: studentProfileRole,
        formationTitle: currentFormation?.title || null,
        enrollCount: Array.isArray(enrollmentRows) ? enrollmentRows.length : 0,
        profileLoaded: profileInfoLoaded,
        enrollLoading,
      }),
    [studentProfileRole, currentFormation, enrollmentRows, profileInfoLoaded, enrollLoading],
  );

  if (authLoading && !user) {
    return (
      <div
        className="flex min-h-[100dvh] w-full items-center justify-center"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT }}
      >
        <p className="text-sm font-medium" style={{ color: EV_MUTED }}>
          Chargement…
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <EleveMobileShell user={user} notificationCount={unreadInbox} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-1 min-w-0">
            <LiriWordmark size="kicker" className="text-white/60" />
            <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Accueil</h1>
            <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED_HOME }}>
              Tableau de bord · apprendre, vivre, grandir
            </p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <HelloHero firstName={firstName} />

          {/*
            P6 — Accueil minimaliste : UNE seule grille d'accès, sans redondance.
            Les 3 anciennes grilles (Accès rapide / Espaces LIRI / Mon École = 13 entrées)
            multipliaient les doublons (Live ×3, Calendrier + Agenda, Classe / Espace élève /
            Vie scolaire, Cours / Modules). On garde l'essentiel et on fusionne :
              • Modules → Cours (bibliotheque)
              • Classe + Espace élève → Vie scolaire
              • Calendrier → Agenda (un seul calendrier)
            Le reste (Neuron, Forfaits, Boutique) reste accessible via Vie scolaire / la
            bibliothèque et le menu de parité — pas besoin de l'exposer sur l'accueil.
          */}
          <EleveSectionTitle className="!mb-3">Accès rapide</EleveSectionTitle>
          <div className="mb-7 grid grid-cols-4 gap-2.5">
            <QuickTile
              to={ELEVE_MOBILE.bibliotheque}
              icon={BookOpen}
              label="Cours"
              accent="blue"
            />
            <QuickTile
              to={ELEVE_MOBILE.live}
              icon={Radio}
              label="Live"
              accent="red"
              live={liveNow}
              soon={liveSoon}
            />
            <QuickTile
              to={ELEVE_MOBILE.vieScolaire}
              icon={School}
              label="Vie scolaire"
              accent="purple"
            />
            <QuickTile
              to={ELEVE_MOBILE.agenda}
              icon={CalendarDays}
              label="Agenda"
              accent="orange"
            />
            <QuickTile
              to={ELEVE_MOBILE.messages}
              icon={MessageCircle}
              label="Messages"
              accent="green"
            />
            <QuickTile
              to={ELEVE_MOBILE.replays}
              icon={PlayCircle}
              label="Replays"
              accent="teal"
            />
            <QuickTile
              to={ELEVE_MOBILE.profile}
              icon={User}
              label="Profil"
              accent="blue"
            />
          </div>

          <EleveSectionTitle action="Voir tout" actionTo={ELEVE_MOBILE.live} dot>
            Live en cours
          </EleveSectionTitle>
          {homeLiveSessions.length === 0 ? (
            <LiveNowCard session={null} viewerUserId={user.id} />
          ) : homeLiveSessions.length === 1 ? (
            <LiveNowCard
              session={homeLiveSessions[0]}
              viewerUserId={user.id}
              isUpcoming={!isHomeOnAirSession(homeLiveSessions[0], user.id)}
            />
          ) : (
            <div className="relative -mx-4 mb-6">
              <div
                className="flex touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pl-4 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
                aria-label="Lives et sessions à venir"
              >
                {homeLiveSessions.map((s) => (
                  <div
                    key={s.id}
                    className="w-[min(20rem,calc(100vw-2rem))] max-w-full shrink-0 snap-center"
                    role="listitem"
                  >
                    <LiveNowCard
                      session={s}
                      viewerUserId={user.id}
                      isUpcoming={!isHomeOnAirSession(s, user.id)}
                      className="mb-0 w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-1">
            <EleveSectionTitle action="Voir tout" actionTo={ELEVE_MOBILE.agenda}>
              À venir
            </EleveSectionTitle>
          </div>

          {agendaLoading ? (
            <p className="mb-4 text-[12.5px] font-medium" style={{ color: EV_MUTED_HOME }}>
              Chargement de l'agenda…
            </p>
          ) : upcomingFromAgenda.length === 0 ? (
            <p className="mb-4 text-[12.5px] font-medium" style={{ color: EV_MUTED_HOME }}>
              Aucun événement bientôt (école, cours ou rendez-vous) — le secrétariat et ton planning
              alimentent cette liste.
            </p>
          ) : (
            upcomingFromAgenda.map((ev, i) => {
              const when = formatSessionScheduleLabel(ev.startAt);
              const rel = formatDistanceToNow(new Date(ev.startAt), { addSuffix: true, locale: frDateFns });
              return (
                <UpcomingItem
                  key={String(ev.id)}
                  icon={CalendarDays}
                  accent={i % 2 === 0 ? 'blue' : 'purple'}
                  when={when}
                  title={ev.title || 'Événement'}
                  sub={agendaEventSubline(ev)}
                  prof={null}
                  profInitial={null}
                  in_={rel}
                  to={agendaItemHref(ev)}
                />
              );
            })
          )}

          <div className="mt-4 mb-1">
            <EleveInfoBanner
              icon={ShieldCheck}
              title={accessInfo.title}
              description={accessInfo.description}
              accent={accessInfo.accent}
              to={accessInfo.to}
            />
          </div>

          <LiriPageFooterLine suffix="Accueil élève" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
