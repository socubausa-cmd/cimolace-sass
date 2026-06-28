import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, Info, Radio, Video, X, Loader2 } from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import {
  hasQuickAccessLiveSignal,
  hasQuickAccessLiveSoonSignal,
  orderHomeLiveSessions,
  isArenaLiveJoinable,
  liveSessionPrimaryHref,
  liveSessionPrimaryCtaLabel,
} from '@/lib/liveAlertSessionUi';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isNativeRuntime } from '@/lib/nativeCapabilities';
import { EV_BG, EV_LINE, EV_MUTED, EV_R } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { format, isToday, isTomorrow } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

function liveHubPanelSurface() {
  return {
    background: 'linear-gradient(198deg, rgba(18, 20, 32, 0.98) 0%, rgba(10, 10, 18, 0.99) 100%)',
    border: '1px solid rgba(165, 180, 252, 0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px -8px rgba(0,0,0,0.45)',
  };
}

/** Format scheduled_at en étiquette lisible */
function formatSessionDate(s) {
  const raw = s.scheduled_at || s.started_at;
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isToday(d)) return `Aujourd'hui · ${format(d, 'HH:mm')}`;
    if (isTomorrow(d)) return `Demain · ${format(d, 'HH:mm')}`;
    return format(d, "EEE d MMM · HH:mm", { locale: frLocale });
  } catch {
    return '';
  }
}

/** Determine tone color based on session status */
function sessionTone(s) {
  const st = String(s.status || '').toLowerCase();
  if (st === 'live') return 'red';
  if (s.scheduled_at) {
    const ms = new Date(s.scheduled_at).getTime() - Date.now();
    if (ms < 30 * 60 * 1000) return 'emerald'; // < 30 min
  }
  return 'violet';
}

const TONE_STYLES = {
  red: {
    iconBg: 'rgba(239,68,68,0.12)',
    icon: '#fca5a5',
    ring: 'rgba(239,68,68,0.25)',
  },
  emerald: {
    iconBg: 'rgba(16,185,129,0.12)',
    icon: '#6ee7b7',
    ring: 'rgba(16,185,129,0.22)',
  },
  violet: {
    iconBg: 'rgba(139,92,246,0.14)',
    icon: '#c4b5fd',
    ring: 'rgba(139,92,246,0.24)',
  },
};

export default function EleveLiveScreen() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  const liveAlertSessions = useLiveAlertsForUser(user?.id ?? null);

  const liveNow = hasQuickAccessLiveSignal(liveAlertSessions, user?.id ?? null);
  const liveSoon = Boolean(
    user?.id && !liveNow && hasQuickAccessLiveSoonSignal(liveAlertSessions, user.id),
  );

  // Sessions ordonnées : en cours en premier, planifiées ensuite
  const orderedSessions = useMemo(
    () => orderHomeLiveSessions(liveAlertSessions, user?.id ?? null),
    [liveAlertSessions, user?.id],
  );

  // Featured = premier (live en cours ou prochain)
  const featuredSession = orderedSessions[0] ?? null;
  const otherSessions = orderedSessions.slice(1);

  const displayName = user?.display_name || user?.displayName ||
    user?.full_name || user?.fullName ||
    user?.name || user?.email?.split('@')[0] || 'Élève';

  const showHostWebBanner = useMemo(
    () => isNativeRuntime() && searchParams.get('hote') === 'web',
    [searchParams],
  );
  const dismissHostBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('hote');
    setSearchParams(next, { replace: true });
  };

  const isLoading = liveAlertSessions === null || liveAlertSessions === undefined;

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
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

        <div className="px-4 pb-2 pt-0.5">
          {showHostWebBanner ? (
            <div
              className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-left"
              role="status"
            >
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-amber-100/95">
                <span className="font-semibold text-amber-50">Mode invité (app mobile).</span> Lancer / animer un live
                se fait sur <strong>le site web</strong> (ordinateur). Ici : rejoindre un lien, suivre le direct et
                les replays.
              </p>
              <button
                type="button"
                onClick={dismissHostBanner}
                className="shrink-0 rounded-lg p-1 text-amber-200/80 transition hover:bg-white/10"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                Bonjour {displayName}
              </h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Voici tes prochains lives.{' '}
                {isNativeRuntime() ? (
                  <span className="text-white/50">(Hôte : ouvrez LIRI sur le web.)</span>
                ) : null}
              </p>
            </div>
            <span
              className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center"
              style={{
                borderRadius: EV_R.md,
                background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                boxShadow: '0 8px 24px -8px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
              aria-hidden
            >
              <Radio className="h-5 w-5 text-white" strokeWidth={2.1} />
            </span>
          </div>
        </div>

        <div className="px-4 pb-4">
          {(liveNow || liveSoon) && (
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{
                background: liveNow ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                border: liveNow ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(245,158,11,0.4)',
              }}
            >
              <span
                className={`h-2 w-2 rounded-full ${liveNow ? 'animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)]' : 'bg-amber-400'}`}
              />
              <span className={`text-[12px] font-semibold ${liveNow ? 'text-red-300' : 'text-amber-300'}`}>
                {liveNow ? 'Un live est en cours maintenant' : 'Un live démarre bientôt'}
              </span>
            </div>
          )}

          {/* Chargement */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              <p className="text-[13px]" style={{ color: EV_MUTED }}>Chargement des lives…</p>
            </div>
          )}

          {/* Sessions réelles */}
          {!isLoading && (
            <div className="space-y-6">
              {/* Featured */}
              {featuredSession ? (
                <section>
                  <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-300/90">
                    {isArenaLiveJoinable(featuredSession, user?.id) ? 'En direct' : 'À venir'}
                  </p>
                  <LiveSessionCard session={featuredSession} userId={user?.id} featured />
                </section>
              ) : (
                /* Aucun live planifié */
                <div
                  className="flex flex-col items-center justify-center rounded-3xl border py-12 gap-3"
                  style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.025)' }}
                >
                  <Radio className="h-8 w-8 text-white/20" strokeWidth={1.5} />
                  <p className="text-[14px] font-semibold text-white/60">Aucun live planifié</p>
                  <p className="text-[12px] text-center max-w-[200px]" style={{ color: EV_MUTED }}>
                    Ton prochain cours en direct apparaîtra ici.
                  </p>
                </div>
              )}

              {/* Sessions suivantes */}
              {otherSessions.length > 0 && (
                <section>
                  <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/42">
                    Plus tard
                  </p>
                  <div className="space-y-3">
                    {otherSessions.map((s) => (
                      <LiveSessionCard key={s.id} session={s} userId={user?.id} />
                    ))}
                  </div>
                </section>
              )}

              {/* Panneau info */}
              <div
                className="flex items-start gap-3 rounded-3xl border p-4"
                style={{ ...liveHubPanelSurface(), borderColor: 'rgba(56,189,248,0.16)' }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/90">Comment ça marche ?</p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                    Rejoins un live à l'heure indiquée. Prépare ton casque et une connexion stable. L\'écran de cours
                    ouvre ensuite la vidéo hôte, le smartboard et les actions invité.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </EleveMobileShell>
  );
}

/**
 * Carte pour une vraie session live (live_sessions row enrichi par useLiveAlertsForUser).
 */
function LiveSessionCard({ session: s, userId, featured = false }) {
  const tone = sessionTone(s);
  const styles = TONE_STYLES[tone] || TONE_STYLES.violet;

  const isLive = isArenaLiveJoinable(s, userId);
  const eyebrow = isLive ? 'LIVE' : (formatSessionDate(s) || 'Planifié');
  const title = s.title || s.session_title || 'Session live';
  const subtitle = s.description || s.session_description || '';
  const teacher = s.teacher_name || s.host_name || '';
  const href = liveSessionPrimaryHref(s, userId);
  const ctaLabel = liveSessionPrimaryCtaLabel(s, userId);

  const card = (
    <div
      className={`group flex gap-3 rounded-3xl border p-3 transition active:scale-[0.99] ${
        featured ? 'shadow-[0_16px_42px_-20px_rgba(59,130,246,0.6)]' : ''
      }`}
      style={{
        background: featured
          ? 'linear-gradient(180deg, rgba(22,22,34,0.98) 0%, rgba(13,13,22,0.99) 100%)'
          : 'rgba(255,255,255,0.035)',
        borderColor: featured ? styles.ring : EV_LINE,
      }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: styles.iconBg, color: styles.icon }}
      >
        {featured ? <Video className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.12em]">
          <span style={{ color: isLive ? '#fca5a5' : 'rgba(255,255,255,0.45)' }}>{eyebrow}</span>
        </div>
        <h3 className="truncate text-[14px] font-bold text-white/95">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-[12px] line-clamp-1" style={{ color: EV_MUTED }}>{subtitle}</p>
        ) : null}
        {teacher ? (
          <p className="mt-2 text-[11px] text-white/45">{teacher}</p>
        ) : null}
        {featured && (
          <div
            className="mt-3 flex h-10 items-center justify-center rounded-2xl text-[12px] font-bold text-white"
            style={{
              background: isLive
                ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: isLive
                ? '0 10px 24px -12px rgba(239,68,68,0.85)'
                : '0 10px 24px -12px rgba(37,99,235,0.85)',
            }}
          >
            {ctaLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        )}
      </div>
      {!featured && <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-white/25" />}
    </div>
  );

  return (
    <Link to={href} className="block">
      {card}
    </Link>
  );
}
