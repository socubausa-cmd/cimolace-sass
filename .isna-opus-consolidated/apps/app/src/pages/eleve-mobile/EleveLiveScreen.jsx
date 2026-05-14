import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, Info, Radio, Video, X } from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import {
  hasQuickAccessLiveSignal,
  hasQuickAccessLiveSoonSignal,
} from '@/lib/liveAlertSessionUi';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { eleveLiveImmersivePath, getStoredImmersiveMode } from '@/lib/eleveLiveImmersive';
import { isNativeRuntime } from '@/lib/nativeCapabilities';
import { EV_BG, EV_LINE, EV_MUTED, EV_R } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

function liveHubPanelSurface() {
  return {
    background: 'linear-gradient(198deg, rgba(18, 20, 32, 0.98) 0%, rgba(10, 10, 18, 0.99) 100%)',
    border: '1px solid rgba(165, 180, 252, 0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px -8px rgba(0,0,0,0.45)',
  };
}

const LIVE_CARDS = [
  {
    tone: 'red',
    eyebrow: 'LIVE',
    time: "Aujourd'hui · 14:30",
    title: 'Physique — Terminale S',
    subtitle: 'Chapitre 3 : Ondes et lumière',
    teacher: 'Prof. Manikongo',
    cta: 'Rejoindre le live',
  },
  {
    tone: 'emerald',
    eyebrow: 'Demain · 10:00',
    time: '',
    title: 'Mathématiques — Terminale S',
    subtitle: 'Chapitre 5 : Suites numériques',
    teacher: 'Prof. Kabasele',
  },
  {
    tone: 'violet',
    eyebrow: 'Jeu. 23 mai · 16:00',
    time: '',
    title: 'Chimie — Terminale S',
    subtitle: 'Chapitre 2 : Réactions chimiques',
    teacher: 'Prof. Nguema',
  },
];

const toneMap = {
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

  const showHostWebBanner = useMemo(
    () => isNativeRuntime() && searchParams.get('hote') === 'web',
    [searchParams],
  );
  const dismissHostBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('hote');
    setSearchParams(next, { replace: true });
  };

  const [, bumpLiveJoin] = useState(0);
  useEffect(() => {
    const onMode = () => bumpLiveJoin((n) => n + 1);
    window.addEventListener('liri:live-immersive-mode', onMode);
    return () => window.removeEventListener('liri:live-immersive-mode', onMode);
  }, []);

  const liveJoinTo = eleveLiveImmersivePath(getStoredImmersiveMode());

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
                LIRI se fait sur <strong>le site web</strong> (ordinateur). Ici : rejoindre un lien, suivre le direct et
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
                Bonjour Élève
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
          {liveNow || liveSoon ? (
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
              <span
                className={`text-[12px] font-semibold ${liveNow ? 'text-red-300' : 'text-amber-300'}`}
              >
                {liveNow ? 'Un live est en cours maintenant' : 'Un live démarre bientôt'}
              </span>
            </div>
          ) : null}

          <div className="space-y-6">
            <section>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-300/90">
                À venir
              </p>
              <LiveScheduleCard live={{ ...LIVE_CARDS[0], to: liveJoinTo }} featured />
            </section>

            <section>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/42">
                Plus tard
              </p>
              <div className="space-y-3">
                {LIVE_CARDS.slice(1).map((live) => (
                  <LiveScheduleCard key={live.title} live={live} />
                ))}
              </div>
            </section>

            <div
              className="flex items-start gap-3 rounded-3xl border p-4"
              style={{
                ...liveHubPanelSurface(),
                borderColor: 'rgba(56,189,248,0.16)',
              }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white/90">Comment ça marche ?</p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                  Rejoins un live à l’heure indiquée. Prépare ton casque et une connexion stable. L’écran de cours
                  ouvre ensuite la vidéo hôte, le smartboard et les actions invité.
                </p>
              </div>
            </div>

            <Link
              to={ELEVE_MOBILE.liveRoomHostView}
              className="group flex items-center justify-between gap-3 rounded-3xl border border-violet-500/25 bg-violet-500/[0.07] px-4 py-3.5 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-300/90">Aperçu UI</p>
                <p className="mt-0.5 text-sm font-bold text-white/95">Salle de cours (maquette)</p>
                <p className="mt-0.5 text-[11px] leading-snug" style={{ color: EV_MUTED }}>
                  Diapos, rétroformateur, ta caméra, chat et questions.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-violet-400/80 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}

function LiveScheduleCard({ live, featured = false }) {
  const tone = toneMap[live.tone] || toneMap.violet;
  const card = (
    <div
      className={`group flex gap-3 rounded-3xl border p-3 transition active:scale-[0.99] ${
        featured ? 'shadow-[0_16px_42px_-20px_rgba(59,130,246,0.6)]' : ''
      }`}
      style={{
        background: featured
          ? 'linear-gradient(180deg, rgba(22,22,34,0.98) 0%, rgba(13,13,22,0.99) 100%)'
          : 'rgba(255,255,255,0.035)',
        borderColor: featured ? tone.ring : EV_LINE,
      }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: tone.iconBg, color: tone.icon }}
      >
        {featured ? <Video className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.12em]">
          <span className={featured ? 'text-red-300' : 'text-white/45'}>{live.eyebrow}</span>
          {live.time ? <span className="text-white/35">{live.time}</span> : null}
        </div>
        <h3 className="truncate text-[14px] font-bold text-white/95">{live.title}</h3>
        <p className="mt-1 text-[12px]" style={{ color: EV_MUTED }}>
          {live.subtitle}
        </p>
        <p className="mt-2 text-[11px] text-white/45">{live.teacher}</p>
        {featured ? (
          <div className="mt-3 flex h-10 items-center justify-center rounded-2xl bg-blue-600 text-[12px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.85)]">
            {live.cta}
            <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        ) : null}
      </div>
      {!featured ? <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-white/25" /> : null}
    </div>
  );

  return live.to ? (
    <Link to={live.to} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
