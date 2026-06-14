import React, { useState } from 'react';
import {
  Camera,
  Hand,
  LogOut,
  Maximize2,
  Menu,
  MessageCircle,
  Mic,
  User,
  Video,
  VideoOff,
} from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { cn } from '@/lib/utils';

const participants = [
  { name: 'Manikongo', role: 'PROF', online: true },
  { name: 'Amina K.', online: true },
  { name: 'Yannick D.', online: true },
  { name: 'Sarah L.', online: true },
  { name: 'Mohamed B.', online: true },
  { name: 'Clara M.', online: true },
];

const SLIDES = [
  { n: 1, label: 'Ondes et lumière' },
  { n: 2, label: 'La vitesse de la lumière' },
  { n: 3, label: "Spectre visible" },
  { n: 4, label: 'Interférences' },
  { n: 5, label: 'Diffraction' },
  { n: 6, label: 'Double fente' },
  { n: 7, label: 'QCM / révision' },
];

const STUDENT_POSTER = '/image-pro/aprendre-a-distance.png';
const PROF_PIP = '/image-pro/hero-liri-village-visio-connaissance.png';

/**
 * Maquette salle : diapo + mini aperçu formateur (PiP), “Ma vidéo” (élève) en dessous du plan de chapitre.
 * Route : `/m/eleve/live/maquette/host` — voir `ELEVE_MOBILE.liveRoomHostView`.
 */
export default function LiriMobileHostView() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [activeSlide, setActiveSlide] = useState(1);

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      hideHeader
      hideTabBar
      contentClassName="!px-0 !max-h-full !min-h-0 !overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="min-h-full w-full bg-[#050812] pb-[env(safe-area-inset-bottom,0px)] text-white">
        <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-col px-4 pb-6 pt-2">

          <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold tracking-wide text-red-400 ring-1 ring-red-500/50">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                LIVE
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-white/80">
                <span aria-hidden>👥</span> 128
              </div>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/90 active:scale-95"
              aria-label="Profil ou réglages"
            >
              <User className="h-5 w-5" strokeWidth={2} />
            </button>
          </header>

          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#0f1525] to-[#080c18] p-4 shadow-2xl ring-1 ring-violet-500/10">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 pr-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90">
                  CHAPITRE {3}
                </p>
                <h1 className="mt-0.5 font-serif text-[22px] font-bold leading-tight tracking-tight text-[#f0e6ff]">
                  {SLIDES[activeSlide].label}
                </h1>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <ProfPip />
                <SpeedometerGlyph className="h-16 w-20 text-violet-500/50 sm:h-20 sm:w-24" />
              </div>
            </div>

            {activeSlide === 1 ? (
              <div className="mt-1 space-y-3 text-left text-sm leading-relaxed text-white/85">
                <p>
                  En physique, on pose que la célérité de la lumière dans le vide, notée{' '}
                  <em>c</em>, est une <strong className="text-white">constante universelle</strong>.
                </p>

                <div className="rounded-xl border-2 border-violet-500/50 bg-violet-950/40 px-3 py-2.5 text-center text-[13px] font-semibold tracking-wide text-violet-200 shadow-inner shadow-violet-500/20">
                  c = 299 792 458 m/s <span className="text-violet-400/80">≈ 300 000 km/s</span>
                </div>

                <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/25 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                    À retenir
                  </p>
                  <ul className="mt-1.5 list-outside list-disc space-y-1.5 pl-4 text-xs text-white/80">
                    <li>
                      La lumière se propage <strong>en ligne droite</strong> en milieu homogène.
                    </li>
                    <li>
                      Son <strong>énergie</strong> transporte l'info couleur et intensité.
                    </li>
                    <li>La vitesse <em>c</em> est la <strong>limite haute</strong> pour toute information.</li>
                  </ul>
                </div>

                <div className="flex items-end justify-center gap-3 pt-1">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 text-[9px] font-bold text-amber-200"
                    title="Soleil"
                  >
                    ☼
                  </div>
                  <div className="h-0 min-w-0 flex-1 border-b border-dashed border-white/25" />
                  <div className="h-2 w-2 rounded-full border border-cyan-400/50 bg-cyan-500/30" />
                  <div className="h-0 min-w-0 flex-1 border-b border-dashed border-white/25" />
                  <div className="h-2 w-2 rounded-full border border-cyan-400/50 bg-cyan-500/30" title="Terre" />
                </div>
                <p className="text-center text-[10px] font-medium text-cyan-200/90">
                  Temps de trajet du Soleil à la Terre ≈ 8 min 20 s
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/55">
                Aperçu de la leçon — pensez à revenir sur « La vitesse de la lumière » pour l'exemple
                complet.
              </p>
            )}
          </section>

          <div className="mt-3">
            <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              Plan du chapitre
            </p>
            <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SLIDES.map((s, i) => {
                const isActive = i === activeSlide;
                return (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => setActiveSlide(i)}
                    className={cn(
                      'group flex min-w-[4.1rem] flex-col items-center rounded-2xl border p-1.5 pt-2 text-center transition',
                      isActive
                        ? 'border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/10'
                        : 'border-white/[0.08] bg-white/[0.04] active:scale-95',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold',
                        isActive
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/[0.08] text-white/70',
                      )}
                    >
                      {s.n}
                    </span>
                    <span
                      className={cn(
                        'mt-1.5 w-full truncate px-0.5 text-[8px] font-medium leading-tight',
                        isActive ? 'text-violet-200' : 'text-white/50',
                      )}
                    >
                      {s.label}
                    </span>
                    {isActive ? <span className="mt-1.5 h-0.5 w-7 rounded-full bg-violet-500" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="mt-2 rounded-[26px] border border-white/10 bg-white/[0.04] p-4 shadow-xl">
            <h2 className="mb-3 text-lg font-bold">Ma vidéo</h2>

            <div className="relative overflow-hidden rounded-[22px] border border-violet-500/60 bg-slate-900">
              <div
                className="relative aspect-[16/9] bg-cover bg-center"
                style={{ backgroundImage: `url('${STUDENT_POSTER}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1.5 text-sm font-bold backdrop-blur-sm">
                  <Video className="h-4 w-4 text-violet-300" strokeWidth={2.2} />
                  <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    ON
                  </span>
                </div>

                <button
                  type="button"
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/95 backdrop-blur-sm active:scale-95"
                  aria-label="Agrandir la vidéo"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>

                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-5">
                  <CircleCtrl icon={Camera} label="Caméra" />
                  <CircleCtrl icon={Mic} label="Micro" />
                  <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 active:scale-95"
                    aria-label="Couper la caméra"
                  >
                    <VideoOff className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-center gap-2" aria-hidden>
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
          </section>

          <section className="mt-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Membres connectés</h2>
                <p className="text-sm text-white/50">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  128 en ligne
                </p>
              </div>

              <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm">
                Voir tous
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {participants.map((p) => (
                <div key={p.name} className="min-w-[66px] text-center">
                  <div className="relative mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 p-[2px]">
                    <div className="h-full w-full rounded-full bg-slate-800" />
                    {p.online ? (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#050812] bg-emerald-400" />
                    ) : null}
                  </div>

                  <p className="mt-2 truncate text-xs">{p.name}</p>

                  {p.role ? (
                    <span className="mt-1 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold">
                      {p.role}
                    </span>
                  ) : null}
                </div>
              ))}

              <div className="flex min-w-[66px] items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-violet-400">
                  +122
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-bold">Chat en direct</h3>
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs">12</span>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-3 text-sm">
                <p className="font-semibold text-violet-400">Amina K.</p>
                <p className="mt-1 text-white/80">Merci beaucoup professeur 🙏</p>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-bold">Questions</h3>
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs">5</span>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-3 text-sm">
                <p className="font-semibold text-violet-400">Yannick D.</p>
                <p className="mt-1 text-white/80">Pourquoi la lumière a-t-elle une vitesse constante ?</p>
              </div>
            </div>
          </section>

          <nav
            className="sticky bottom-0 z-10 mt-4 rounded-[30px] border border-white/10 bg-[#0b101c]/95 px-3 py-3 backdrop-blur-xl"
            style={{ marginBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
            aria-label="Actions session"
          >
            <div className="mx-auto flex max-w-[400px] items-end justify-between gap-0.5">
              <BarAction icon={Menu} label="Menu" />
              <BarAction icon={MessageCircle} label="Chat" />

              <button
                type="button"
                className="relative -mt-6 flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_0_32px_rgba(124,58,237,0.75),0_8px_24px_rgba(0,0,0,0.35)] ring-4 ring-[#0b101c] active:scale-95"
                aria-label="Micro"
              >
                <Mic className="h-9 w-9" strokeWidth={2.2} />
              </button>

              <BarAction icon={Hand} label="Lever la main" />
              <BarAction icon={LogOut} label="Quitter" danger />
            </div>
          </nav>
        </div>
      </div>
    </EleveMobileShell>
  );
}

function ProfPip() {
  return (
    <div
      className="relative w-[6.25rem] overflow-hidden rounded-2xl border-2 border-violet-500/50 bg-slate-900/95 shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-black/30"
      title="Formateur en direct"
    >
      <div
        className="aspect-video w-full bg-cover bg-center"
        style={{ backgroundImage: `url('${PROF_PIP}')` }}
        role="img"
        aria-label="Aperçu caméra formateur"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/55 pl-0.5 pr-1.5 py-0.5 text-[7px] font-extrabold tracking-wide text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
        PROF
      </div>
    </div>
  );
}

function BarAction({ icon: Icon, label, danger = false }) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-w-0 max-w-[4.5rem] flex-1 flex-col items-center justify-end gap-1.5 py-0.5 text-center',
        danger ? 'text-red-400' : 'text-white/80',
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center" aria-hidden>
        <Icon className={cn('h-6 w-6', danger && 'text-red-500')} strokeWidth={2.2} />
      </span>
      <span className="w-full break-words text-[9px] font-medium leading-tight text-white/75 [overflow-wrap:anywhere]">
        {label}
      </span>
    </button>
  );
}

function CircleCtrl({ icon: Icon, label }) {
  return (
    <button
      type="button"
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm active:scale-95"
      aria-label={label}
    >
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </button>
  );
}

function SpeedometerGlyph({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 64 A40 40 0 0 1 80 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-violet-500/30"
      />
      <path
        d="M8 64 A40 40 0 0 1 64 32"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-fuchsia-400/90"
      />
      <line x1="48" y1="64" x2="64" y2="32" stroke="currentColor" strokeWidth="2" className="text-white/80" />
      <circle cx="48" cy="64" r="3" className="fill-violet-400" />
    </svg>
  );
}
