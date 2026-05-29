import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Hand,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Users,
  Video,
} from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiveImmersiveScreenSwitcher } from '@/components/eleve-mobile/LiveImmersiveScreenSwitcher';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

/**
 * **Affichage immersif** (variante par défaut) — visuel proche de la ref
 * (`public/maquettes/liri-live-mobile-reference.png`). Côté invité : pas de carrousel
 * (pilotage des slides côté hôte). Autres variantes : `lib/eleveLiveImmersive.js`, ex. `/live/maquette/alpha`.
 */
const LIVE_ROOM_BG = '#0A0B14';
const PURPLE = '#6339F9';
const PURPLE_MUTED = 'rgba(99, 57, 249, 0.16)';
const GREEN = '#1DB954';
const RED = '#E53E3E';

/** Capture d'écran de référence — utilisée pour le cadrage « Prof » en incrustation (découpe visuelle). */
const REF_MAQUETTE = '/maquettes/liri-live-mobile-reference.png';

const MOCK_MEMBERS = [
  { name: 'Manikongo', isProf: true, src: null },
  { name: 'Aïcha', src: null, bg: 'linear-gradient(145deg, #e879a8 0%, #a21caf 100%)' },
  { name: 'Jean', src: null, bg: 'linear-gradient(145deg, #4ade80 0%, #15803d 100%)' },
  { name: 'Léa', src: null, bg: 'linear-gradient(145deg, #fbbf24 0%, #c2410c 100%)' },
];

/**
 * Maquette **salle de live mobile invité** — aucune donnée LiveKit / Supabase.
 * Route : `ELEVE_MOBILE.liveRoomMaquette` → `/m/eleve/live/maquette`.
 */
export default function EleveLiveRoomShellMaquette() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      hideHeader
      hideTabBar
      contentClassName="!px-0"
    >
      <div
        className="font-display flex h-full min-h-0 w-full flex-1 flex-col text-white antialiased"
        style={{
          backgroundColor: LIVE_ROOM_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div
          className="shrink-0 px-4"
          style={{ paddingTop: 'max(0.2rem, env(safe-area-inset-top, 0px))' }}
        >
          <LiriStatusBar />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
          <LiveHeader />
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SmartboardStage />
            <LiveImmersiveScreenSwitcher active="default" className="pt-1" />
            <ConnectedMembersRow />
            <div className="h-2 shrink-0" />
          </div>
        </div>

        <GuestActionFooter />
      </div>
    </EleveMobileShell>
  );
}

function LiveHeader() {
  return (
    <header className="mb-2.5 shrink-0">
      <div className="mb-2.5 flex items-center justify-between gap-1.5">
        <Link
          to={ELEVE_MOBILE.live}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-white/90 active:scale-95"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}
          aria-label="Retour aux lives"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.1} />
        </Link>

        <div className="min-w-0 flex-1 pl-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wider text-white"
              style={{ backgroundColor: RED, boxShadow: '0 2px 8px rgba(229, 62, 62, 0.45)' }}
            >
              LIVE
            </span>
            <p className="truncate text-[14px] font-bold leading-tight text-white">Physique – Terminale S</p>
          </div>
          <p
            className="mt-0.5 truncate text-[10px] font-medium leading-tight"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            Chapitre 3 : Ondes et lumière
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="flex h-8 min-w-0 items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] pl-1.5 pr-2.5 text-[12px] font-semibold"
            style={{ color: 'rgba(255,255,255,0.88)' }}
          >
            <Users className="h-[15px] w-[15px] text-white/65" strokeWidth={2.2} />
            128
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] text-white/90"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}
            aria-label="Options"
          >
            <MoreHorizontal className="h-[20px] w-[20px]" />
          </button>
        </div>
      </div>
    </header>
  );
}

function SmartboardStage() {
  return (
    <section className="pb-2.5">
      <div
        className="flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-[18px] border"
        style={{
          borderColor: 'rgba(99, 57, 249, 0.3)',
          background: 'linear-gradient(175deg, rgba(16,18,30,0.99) 0%, rgba(6,7,14,0.995) 100%)',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 50px -28px ${PURPLE}99`,
        }}
      >
        <div
          className="relative max-h-[min(52vh,420px)] min-h-[200px] flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:max-h-[min(55vh,480px)]"
          style={{
            background: [
              'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(99, 57, 249, 0.14) 0%, transparent 58%)',
              'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.1) 100%)',
            ].join(','),
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative z-[1] pb-1 pr-[118px] min-[400px]:pr-[130px]">
            <div
              className="inline-flex rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-white"
              style={{ background: `linear-gradient(100deg, ${PURPLE} 0%, #7c3aed 100%)` }}
            >
              Chapitre 3
            </div>
            <h1 className="mt-3 max-w-[260px] text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white min-[400px]:text-[30px]">
              La vitesse de la lumière
            </h1>
            <div
              className="mt-3.5 h-[3px] w-14 rounded-full"
              style={{ background: `linear-gradient(90deg, ${PURPLE} 0%, #a78bfa 100%)` }}
            />

            <p className="mt-3 max-w-[300px] text-[14px] leading-[1.55]" style={{ color: 'rgba(255,255,255,0.8)' }}>
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
          </div>

          <HostVideoInset />

          <div className="relative z-[1] -mt-1 max-w-sm px-0">
            <div
              className="mt-4 rounded-[14px] border p-3"
              style={{
                borderColor: 'rgba(99, 57, 249, 0.4)',
                background: PURPLE_MUTED,
                boxShadow: `0 0 32px -12px ${PURPLE}cc`,
              }}
            >
              <div
                className="mb-1.5 inline-block rounded px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] text-white"
                style={{ background: PURPLE }}
              >
                Valeur officielle
              </div>
              <div className="flex items-center justify-between gap-2">
                <p
                  className="min-w-0 text-[20px] font-extrabold leading-tight min-[400px]:text-[22px]"
                  style={{ color: '#c4b5fd' }}
                >
                  c = 299 792 458 m/s
                  <br />
                  <span style={{ color: 'rgba(255,255,255,0.72)' }}>≈ 300 000 km/s</span>
                </p>
                <SpeedGauge />
              </div>
            </div>

            <div
              className="mt-3 rounded-[14px] border p-3"
              style={{
                borderColor: 'rgba(29, 185, 84, 0.35)',
                background: 'rgba(29, 185, 84, 0.08)',
              }}
            >
              <div
                className="mb-2 inline-block rounded px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] text-white"
                style={{ background: GREEN, boxShadow: '0 2px 8px rgba(29, 185, 84, 0.35)' }}
              >
                À retenir
              </div>
              <div className="grid grid-cols-1 items-start gap-2 min-[360px]:grid-cols-[1fr_96px]">
                <ul className="space-y-2.5 text-[11px] leading-[1.45]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {[
                    'La vitesse de la lumière est la plus grande vitesse de l\'univers.',
                    'Elle est la même dans le vide pour tous les observateurs.',
                    'C\'est une constante fondamentale de la physique.',
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span
                        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                        style={{ backgroundColor: GREEN }}
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-center text-[9px] leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <div className="mb-1.5 flex items-center justify-center gap-1.5 text-2xl">
                    <span>☀️</span>
                    <span style={{ color: PURPLE }}>→</span>
                    <span>🌍</span>
                  </div>
                  <p className="text-[9px] text-white/50">
                    Lumière du soleil → Terre
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold" style={{ color: PURPLE }}>
                    8 min 20 s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpeedGauge() {
  return (
    <div
      className="relative h-[72px] w-[72px] shrink-0 rounded-full border bg-black/35"
      style={{ borderColor: 'rgba(167, 139, 250, 0.35)', boxShadow: 'inset 0 0 20px rgba(99, 57, 249, 0.35)' }}
    >
      <div
        className="absolute left-1/2 top-1/2 h-1.5 w-[34px] origin-left -translate-y-1/2 rotate-[-32deg] rounded-full"
        style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: PURPLE, boxShadow: `0 0 6px ${PURPLE}` }}
      />
    </div>
  );
}

/**
 * Cadrage depuis la capture de référence : zoom sur la zone vidéo hôte (coin haut-droit du visuel d'origine).
 */
function HostVideoInset() {
  return (
    <div
      className="absolute right-2 top-[52px] z-10 w-[120px] overflow-hidden rounded-2xl border border-white/15 bg-black/80 min-[400px]:right-3 min-[400px]:top-14 min-[400px]:w-[132px]"
      style={{ boxShadow: '0 18px 40px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(99, 57, 249, 0.15)' }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={REF_MAQUETTE}
            alt=""
            className="h-full w-full min-h-full min-w-full"
            style={{
              objectFit: 'cover',
              objectPosition: '70% 22%',
              transform: 'scale(1.22)',
              transformOrigin: '70% 22%',
              filter: 'brightness(1.1) contrast(1.05) saturate(1.05)',
            }}
            width={200}
            height={250}
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
        <button
          type="button"
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-black/45 text-white/90"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          aria-label="Agrandir le flux hôte"
        >
          <Video className="h-3 w-3" />
        </button>
        <div
          className="absolute bottom-0 left-0 right-0 px-1.5 py-1.5"
          style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 70%, transparent 100%)',
          }}
        >
          <div className="flex items-end justify-between gap-0.5">
            <p className="min-w-0 flex-1 truncate pr-1 text-[7px] font-bold leading-none text-white">
              Prof. Manikongo
            </p>
            <div className="flex shrink-0 items-end gap-0.5 pb-px pr-0.5">
              <AudioWaveIcon />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioWaveIcon() {
  return (
    <div className="flex h-3.5 items-end justify-end gap-px" aria-hidden>
      {[0.3, 0.65, 0.4, 0.85, 0.5].map((f, i) => (
        <span
          key={i}
          className="w-0.5 rounded-[0.5px] bg-sky-400"
          style={{ height: 4 + 9 * f }}
        />
      ))}
    </div>
  );
}

function ConnectedMembersRow() {
  return (
    <section className="mt-0.5 shrink-0 border-t border-white/[0.06] pt-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-white"
        >
          <span>Membres connectés</span>
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-normal"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: GREEN, boxShadow: `0 0 5px ${GREEN}` }}
            />
            128 en ligne
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-[#6339F9]/5 px-2.5 py-1 text-[10px] font-semibold"
          style={{ borderColor: 'rgba(99, 57, 249, 0.55)', color: PURPLE, background: 'rgba(99, 57, 249, 0.08)' }}
        >
          Voir tous
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOCK_MEMBERS.map((m) => (
          <div key={m.name} className="flex w-[50px] shrink-0 flex-col items-center gap-0.5">
            <div className="relative">
              {m.isProf ? (
                <div className="h-10 w-10 overflow-hidden rounded-full">
                  <img
                    src={REF_MAQUETTE}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: '70% 22%',
                      transform: 'scale(1.2)',
                      transformOrigin: '55% 28%',
                      filter: 'brightness(1.1) contrast(1.05)',
                    }}
                    width={50}
                    height={50}
                  />
                </div>
              ) : (
                <div
                  className="h-10 w-10 rounded-full"
                  style={{ background: m.bg, boxShadow: '0 4px 10px -3px rgba(0,0,0,0.5)' }}
                />
              )}
              {m.isProf ? (
                <span
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[5.5px] font-black uppercase leading-none text-white"
                  style={{ background: PURPLE, border: '1px solid rgba(0,0,0,0.2)' }}
                >
                  Prof
                </span>
              ) : null}
              <span
                className="absolute bottom-0 right-0.5 h-2 w-2 rounded-full border-2"
                style={{ backgroundColor: GREEN, borderColor: LIVE_ROOM_BG }}
              />
            </div>
            <p
              className="w-full max-w-[52px] truncate text-center text-[8px] font-medium leading-tight"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {m.name}
            </p>
          </div>
        ))}
        <div className="flex w-[50px] shrink-0 flex-col items-center gap-0.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-bold text-white/95"
            style={{ background: `linear-gradient(145deg, ${PURPLE} 0%, #4c1d95 100%)` }}
          >
            +120
          </div>
        </div>
      </div>
    </section>
  );
}

function GuestActionFooter() {
  return (
    <footer
      className="z-20 shrink-0 border-t"
      style={{
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(10,11,20,0.65) 100%)',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
        paddingTop: 8,
      }}
    >
      <div className="mx-auto max-w-md px-1">
        <div
          className="grid items-end gap-0"
          style={{ gridTemplateColumns: '1fr 1fr 1.35fr 1fr 1fr' }}
        >
          <SmallFooterBtn Icon={Menu} label="Menu" />
          <SmallFooterBtn Icon={MessageCircle} label="Chat" />
          <div className="flex flex-col items-center justify-end -mt-1">
            <button
              type="button"
              className="flex h-[60px] w-[60px] items-center justify-center rounded-full text-white"
              style={{
                background: `radial-gradient(circle at 30% 25%, #8b5cf6 0%, ${PURPLE} 45%, #3b0ca8 100%)`,
                boxShadow: `0 0 0 2px rgba(99, 57, 249, 0.45), 0 12px 32px -6px ${PURPLE}cc, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
              disabled
              aria-label="Micro"
            >
              <Mic className="h-8 w-8" strokeWidth={2.2} />
            </button>
            <span className="mt-0.5 text-[8px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Micro
            </span>
          </div>
          <SmallFooterBtn Icon={Hand} label="Lever la main" />
          <SmallFooterBtn Icon={LogOut} label="Quitter" danger />
        </div>
        <div className="mx-auto mt-1.5 h-1 w-[28%] min-w-[100px] max-w-[120px] rounded-full bg-white/2" style={{ background: 'rgba(255,255,255,0.2)' }} aria-hidden />
      </div>
    </footer>
  );
}

function SmallFooterBtn({ Icon, label, danger }) {
  return (
    <div className="flex flex-col items-center justify-end gap-0.5 pb-1.5 text-center">
      <button
        type="button"
        className="mb-0.5 flex h-8 w-8 items-center justify-center text-white/55 active:scale-95"
        style={{ color: danger ? RED : 'rgba(255,255,255,0.55)' }}
        disabled
        aria-label={label}
      >
        <Icon className="h-5 w-5" strokeWidth={2.1} />
      </button>
      <span
        className="w-full text-[8px] font-medium leading-[1.1] text-center"
        style={{ color: danger ? RED : 'rgba(255,255,255,0.42)' }}
      >
        {label}
      </span>
    </div>
  );
}
