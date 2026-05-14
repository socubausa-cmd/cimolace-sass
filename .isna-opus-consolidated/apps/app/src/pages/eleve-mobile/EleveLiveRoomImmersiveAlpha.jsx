import React from 'react';
import {
  Camera,
  Hand,
  LogOut,
  Maximize2,
  Menu,
  MessageCircle,
  Mic,
} from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiveImmersiveScreenSwitcher } from '@/components/eleve-mobile/LiveImmersiveScreenSwitcher';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { cn } from '@/lib/utils';
/**
 * **Affichage immersif Alpha** — aperçu hôte **16:9** (image plein cadre, pas d’écran-téléphone) + smartboard + ma vidéo / membres.
 * Route : `/m/eleve/live/maquette/alpha` (cf. `eleveMobileRoutes`).
 */
const BG = '#000000';
const PURPLE = '#7C4DFF';
const PURPLE_MUTED = 'rgba(124, 77, 255, 0.32)';
const PURPLE_DEEP = '#5B3FD9';
const GREEN = '#00E676';
const RED = '#FF5252';
const CARD = '#0a0c10';
const LINE = 'rgba(255, 255, 255, 0.06)';
/** Aperçu du flux hôte (visio / scène — recadrage naturel, pas de maquette de téléphone). */
const HOST_STREAM_POSTER = '/image-pro/hero-liri-village-visio-connaissance.png';
const REF_AVATAR_HOST = HOST_STREAM_POSTER;

const MEMBRES = [
  { n: 'Manikongo', prof: true, bg: null },
  { n: 'Amina K.', prof: false, bg: 'linear-gradient(140deg, #f472b6, #9d174d)' },
  { n: 'Yannick D.', prof: false, bg: 'linear-gradient(140deg, #60a5fa, #1d4ed8)' },
  { n: 'Sarah L.', prof: false, bg: 'linear-gradient(140deg, #a78bfa, #5b21b6)' },
];

function LiveWaveform({ className }) {
  return (
    <div className={cn('flex items-end justify-end gap-[2px]', className)}>
      {[0.3, 0.75, 0.5, 0.9, 0.4].map((f, i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px] bg-cyan-300/95"
          style={{ height: 3 + 8 * f }}
        />
      ))}
    </div>
  );
}

export default function EleveLiveRoomImmersiveAlpha() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      hideHeader
      hideTabBar
      contentClassName="!flex !h-full !min-h-0 !max-h-full !flex-col !overflow-hidden !px-0"
    >
      <div
        className="font-display flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden text-white antialiased"
        style={{ backgroundColor: BG }}
      >
        <div
          className="shrink-0 px-4"
          style={{ paddingTop: 'max(0.2rem, env(safe-area-inset-top, 0px))' }}
        >
          <LiriStatusBar />
        </div>
        {/** Maquette 1:1 : pas de bandeau Immersif / Alpha (choix profil + URL `/maquette/…`). */}
        <LiveImmersiveScreenSwitcher active="alpha" className="!hidden" />

        <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-md flex-1 flex-col overflow-hidden px-4">
          <HostVideoSection />

          <div
            className="mt-1.5 flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 overflow-hidden min-[400px]:mt-2 min-[400px]:gap-2"
            style={{ minHeight: 0 }}
          >
            <div
              className="flex min-h-0 w-full flex-1 flex-col space-y-2 overflow-hidden rounded-[24px] border p-3 min-[400px]:space-y-2.5 min-[400px]:p-3.5"
              style={{
                borderColor: PURPLE_MUTED,
                background: `linear-gradient(165deg, ${CARD} 0%, #030305 100%)`,
                boxShadow: `inset 0 1px 0 ${LINE}, 0 8px 32px -12px rgba(0,0,0,0.75)`,
              }}
            >
              <div className="flex min-h-0 shrink-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-0.5">
                  <div
                    className="mb-1 inline-block rounded-md px-2.5 py-[5px] text-[7px] font-black uppercase tracking-[0.12em] text-white min-[400px]:px-3 min-[400px]:text-[8px]"
                    style={{ background: `linear-gradient(98deg, ${PURPLE} 0%, #9B7CFF 100%)` }}
                  >
                    Chapitre 3
                  </div>
                  <h1 className="mt-1.5 text-[17px] font-extrabold leading-[1.12] tracking-[-0.022em] text-white min-[400px]:text-[19px]">
                    La vitesse de la lumière
                  </h1>
                </div>
                <div className="shrink-0 self-start pt-0.5">
                  <SpeedGaugeAlpha />
                </div>
              </div>

              <p
                className="shrink-0 text-[10.5px] leading-[1.42] min-[400px]:text-[12px] min-[400px]:leading-[1.45]"
                style={{ color: 'rgba(255,255,255,0.88)' }}
              >
                La lumière se déplace dans le vide à une{' '}
                <span className="font-semibold" style={{ color: PURPLE }}>
                  vitesse constante
                </span>{' '}
                notée{' '}
                <span className="font-bold" style={{ color: PURPLE }}>
                  c
                </span>
                .
              </p>

              <div
                className="shrink-0 rounded-2xl border p-2"
                style={{ borderColor: 'rgba(124, 77, 255, 0.45)', background: 'rgba(124, 77, 255, 0.08)' }}
              >
                <div
                  className="mb-1 inline-block rounded px-2 py-[3px] text-[6px] font-black uppercase tracking-[0.1em] text-white min-[400px]:text-[7px]"
                  style={{ background: PURPLE_DEEP }}
                >
                  Valeur officielle
                </div>
                <p className="text-[15px] font-extrabold leading-snug min-[400px]:text-base" style={{ color: '#d4c4ff' }}>
                  c = 299 792 458 m/s
                </p>
                <p
                  className="mt-0.5 text-[10.5px] font-bold leading-tight min-[400px]:text-xs"
                  style={{ color: 'rgba(200, 190, 255, 0.72)' }}
                >
                  ≈ 300 000 km/s
                </p>
              </div>

              <div
                className="min-h-0 flex-1 overflow-hidden rounded-2xl border p-2"
                style={{ borderColor: 'rgba(0, 230, 118, 0.35)', background: 'rgba(0, 230, 118, 0.06)' }}
              >
                <div
                  className="mb-1 inline-block rounded px-2 py-[3px] text-[6px] font-black uppercase tracking-[0.1em] text-[#0a0a0a] min-[400px]:text-[7px]"
                  style={{ background: GREEN }}
                >
                  À retenir
                </div>
                <div className="grid grid-cols-1 items-start gap-2 min-[360px]:grid-cols-[1fr_76px] min-[400px]:grid-cols-[1fr_84px]">
                  <ul className="min-h-0 space-y-1 text-[9px] leading-[1.34] text-white/85 min-[400px]:text-[10.5px] min-[400px]:leading-[1.38]">
                    {[
                      "La vitesse de la lumière est la plus grande vitesse de l’univers.",
                      'Elle est la même dans le vide pour tous les observateurs.',
                      'C’est une constante fondamentale de la physique.',
                    ].map((x) => (
                      <li key={x} className="flex gap-1">
                        <span
                          className="mt-0.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full text-[5px] font-bold text-[#0a0a0a] min-[400px]:h-3 min-[400px]:w-3"
                          style={{ background: GREEN }}
                        >
                          ✓
                        </span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="shrink-0 self-center text-center min-[360px]:self-center">
                    <div className="mb-0 flex items-center justify-center gap-0.5 text-lg min-[400px]:text-xl">
                      <span>☀️</span>
                      <span style={{ color: PURPLE }}>→</span>
                      <span>🌍</span>
                    </div>
                    <p className="text-[7px] text-white/45 min-[400px]:text-[8px]">Lumière du soleil → Terre</p>
                    <p className="text-[9px] font-bold leading-tight min-[400px]:text-[10px]" style={{ color: PURPLE }}>
                      8 min 20 s
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-0 flex w-full min-h-0 shrink-0 items-stretch gap-2.5 min-[400px]:gap-3">
              <MaVideoTile />
              <MembresBlock />
            </div>
          </div>
        </div>

        <ImmersiveAlphaFooter className="shrink-0" />
      </div>
    </EleveMobileShell>
  );
}

function HostVideoSection({ className }) {
  return (
    <div
      className={cn(
        'relative w-full min-h-0 flex-1 overflow-hidden rounded-2xl min-[400px]:rounded-3xl',
        className,
      )}
      style={{
        background: '#08080c',
        boxShadow: `inset 0 1px 0 ${LINE}, 0 4px 24px -8px rgba(0,0,0,0.6)`,
      }}
    >
      <div className="relative aspect-video w-full min-h-0 min-w-0">
        <img
          src={HOST_STREAM_POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 42%' }}
          sizes="(max-width: 448px) 100vw, 448px"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div
          className="pointer-events-none absolute inset-0 z-[4]"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 32%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.75) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-24"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
          }}
        />
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between gap-2 min-[400px]:left-3.5 min-[400px]:right-3.5 min-[400px]:top-3.5">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
            style={{
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
              style={{ background: RED, boxShadow: `0 0 4px ${RED}` }}
            />
            <span className="text-[8.5px] font-black uppercase tracking-wider text-white min-[400px]:text-[9px]">LIVE</span>
          </div>
          <button
            type="button"
            className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/50 text-white/95 outline-none ring-0 backdrop-blur-md min-[400px]:h-9 min-[400px]:w-9"
            aria-label="Plein écran"
          >
            <Maximize2 className="h-[15px] w-[15px] min-[400px]:h-4 min-[400px]:w-4" strokeWidth={2.1} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between gap-2 px-2.5 pb-2.5 pt-2 min-[400px]:px-3.5 min-[400px]:pb-3">
          <p
            className="min-w-0 text-[10px] font-semibold text-white/95 min-[400px]:text-[11px]"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
          >
            Prof. Manikongo
          </p>
          <LiveWaveform className="h-3.5 min-[400px]:h-4" />
        </div>
      </div>
    </div>
  );
}

function SpeedGaugeAlpha() {
  return (
    <div
      className="relative h-12 w-12 rounded-full border-2 min-[400px]:h-14 min-[400px]:w-14"
      style={{
        borderColor: 'rgba(124, 77, 255, 0.5)',
        background: 'radial-gradient(circle at 40% 35%, rgba(124,77,255,0.25) 0%, #0a0a0f 70%)',
        boxShadow: 'inset 0 0 20px rgba(124, 77, 255, 0.25), 0 0 20px -8px rgba(124, 77, 255, 0.4)',
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 180deg at 50% 50%, rgba(255,100,50,0.2) 0deg, transparent 100deg, transparent 360deg)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-1 w-5 origin-left -translate-y-1/2 rotate-[-20deg] rounded-full min-[400px]:h-1.5 min-[400px]:w-7"
        style={{ background: 'linear-gradient(90deg, #ff7043, #ffca28)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 min-[400px]:h-2.5 min-[400px]:w-2.5"
        style={{ background: PURPLE, borderColor: 'rgba(255,255,255,0.2)' }}
      />
    </div>
  );
}

function MaVideoTile() {
  return (
    <div className="w-[35%] min-w-[98px] max-w-[44%] shrink-0">
      <p className="mb-1 text-[7.5px] font-bold uppercase tracking-wide text-white/40 min-[400px]:text-[8.5px]">Ma vidéo</p>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border"
        style={{
          background: 'linear-gradient(160deg, #1a1d2e 0%, #0a0a12 100%)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          className="absolute inset-0 opacity-80"
          style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(80, 120, 200, 0.25) 0%, transparent 50%)' }}
        />
        <div
          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border bg-black/45"
          style={{ borderColor: 'rgba(124,77,255,0.4)' }}
        >
          <Camera className="h-2.5 w-2.5" style={{ color: PURPLE }} />
        </div>
        <div
          className="absolute bottom-1.5 left-0 right-0 text-center text-[6.5px] font-medium"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          Aperçu
        </div>
      </div>
    </div>
  );
}

function MembresBlock() {
  return (
    <div
      className="min-w-0 flex-1 overflow-hidden rounded-2xl border bg-white/[0.02] p-2 min-[400px]:p-2.5"
      style={{ borderColor: LINE }}
    >
      <div className="mb-1 flex min-w-0 items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-[9.5px] font-bold text-white/95 min-[400px]:text-[10.5px]">Membres connectés</p>
          <p className="mt-0 flex items-center gap-1 text-[7px] min-[400px]:text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: GREEN, boxShadow: `0 0 4px ${GREEN}` }}
            />
            128 en ligne
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border px-1 py-0.5 text-[7px] font-semibold min-[400px]:px-1.5 min-[400px]:text-[8px]"
          style={{ borderColor: 'rgba(124, 77, 255, 0.5)', color: PURPLE, background: 'rgba(124, 77, 255, 0.08)' }}
        >
          Voir tous
        </button>
      </div>
      <div className="flex min-w-0 items-start gap-1 overflow-hidden [scrollbar-width:none] min-[400px]:gap-1.5">
        {MEMBRES.map((m) => (
          <div key={m.n} className="w-[32px] shrink-0 text-center min-[400px]:w-10">
            <div className="relative mx-auto w-7 min-[400px]:w-8">
              {m.prof ? (
                <div className="h-7 w-7 overflow-hidden rounded-full border border-white/12 min-[400px]:h-8 min-[400px]:w-8">
                  <img
                    src={REF_AVATAR_HOST}
                    alt=""
                    className="h-full w-full min-h-full min-w-full object-cover"
                    style={{ objectPosition: '50% 45%' }}
                    width={32}
                    height={32}
                  />
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full min-[400px]:h-8 min-[400px]:w-8" style={{ background: m.bg }} />
              )}
              {m.prof ? (
                <span
                  className="absolute -bottom-0.5 left-1/2 w-max min-w-0 -translate-x-1/2 rounded px-0.5 py-px text-[5.5px] font-black text-white"
                  style={{ background: PURPLE }}
                >
                  Prof
                </span>
              ) : null}
              <span
                className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full border-2"
                style={{ background: GREEN, borderColor: BG }}
              />
            </div>
            <p className="mt-1 line-clamp-1 text-center text-[6px] text-white/42 min-[400px]:text-[6.5px]">{m.n}</p>
          </div>
        ))}
        <div className="w-[32px] shrink-0 text-center min-[400px]:w-10">
          <div
            className="mx-auto flex h-7 w-7 min-[400px]:h-8 min-[400px]:w-8 items-center justify-center rounded-full text-[7px] font-extrabold min-[400px]:text-[7.5px]"
            style={{ background: `linear-gradient(140deg, ${PURPLE} 0%, #4a1d7a 100%)` }}
          >
            +124
          </div>
        </div>
      </div>
    </div>
  );
}

function ImmersiveAlphaFooter({ className }) {
  return (
    <footer
      className={cn('z-20 shrink-0 border-t', className)}
      style={{
        borderColor: LINE,
        background: 'linear-gradient(180deg, rgba(4,4,8,0.2) 0%, rgba(6,6,10,0.95) 100%)',
        paddingBottom: 'max(2px, env(safe-area-inset-bottom, 0px))',
        paddingTop: 4,
      }}
    >
      <div className="mx-auto max-w-md px-0.5">
        <div
          className="grid w-full max-w-md items-end gap-0"
          style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 1fr' }}
        >
          <FooterBtn Icon={Menu} label="Menu" />
          <FooterBtn Icon={MessageCircle} label="Chat" />
          <div className="flex flex-col items-center justify-end">
            <button
              type="button"
              className="flex h-10 w-10 min-[400px]:h-11 min-[400px]:w-11 items-center justify-center rounded-full text-white"
              style={{
                background: `radial-gradient(circle at 30% 25%, #9d7cff 0%, ${PURPLE} 50%, #4a1d9e 100%)`,
                boxShadow: `0 0 0 1.5px rgba(124, 77, 255, 0.45), 0 4px 16px -3px ${PURPLE}cc, inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
              disabled
              aria-label="Micro"
            >
              <Mic className="h-[18px] w-[18px] min-[400px]:h-5 min-[400px]:w-5" strokeWidth={2.1} />
            </button>
            <span className="mt-px text-[6px] leading-tight text-white/35 min-[400px]:text-[7px]">Micro</span>
          </div>
          <FooterBtn Icon={Hand} label="Lever la main" />
          <FooterBtn Icon={LogOut} label="Quitter" red />
        </div>
        <div className="mx-auto mt-0.5 h-0.5 w-[28%] max-w-[90px] min-w-[72px] rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} aria-hidden />
      </div>
    </footer>
  );
}

function FooterBtn({ Icon, label, red }) {
  return (
    <div className="flex min-h-0 flex-col items-center justify-end gap-0 pb-px text-center">
      <button
        type="button"
        className="mb-0 flex h-7 w-7 min-[400px]:h-8 min-[400px]:w-8 items-center justify-center active:scale-95"
        style={{ color: red ? RED : 'rgba(255,255,255,0.5)' }}
        disabled
        aria-label={label}
      >
        <Icon className="h-[17px] w-[17px] min-[400px]:h-5 min-[400px]:w-5" strokeWidth={2} />
      </button>
      <span
        className="w-full text-[6.5px] font-medium leading-[1.1] min-[400px]:text-[7px]"
        style={{ color: red ? 'rgba(255,82,82,0.95)' : 'rgba(255,255,255,0.38)' }}
      >
        {label}
      </span>
    </div>
  );
}
