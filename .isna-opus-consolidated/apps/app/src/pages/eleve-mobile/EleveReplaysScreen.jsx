import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Play, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { EV_BG, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

const LIST_HALO = [
  'rgba(45, 212, 191, 0.1)',
  'rgba(99, 102, 241, 0.12)',
  'rgba(124, 58, 237, 0.1)',
];

function replayRowSurface(index) {
  const h = LIST_HALO[index % LIST_HALO.length];
  return {
    background: [
      `radial-gradient(ellipse 100% 80% at 0% 0%, ${h} 0%, transparent 55%)`,
      'linear-gradient(195deg, rgba(24, 26, 40, 0.97) 0%, rgba(10, 12, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px -4px rgba(0,0,0,0.4)',
  };
}

function continueCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 20% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 58%)',
      'linear-gradient(190deg, rgba(26, 22, 48, 0.98) 0%, rgba(10, 10, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.22)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.1)',
      '0 12px 32px -12px rgba(99, 102, 241, 0.25)',
      '0 4px 16px -4px rgba(0,0,0,0.45)',
    ].join(', '),
  };
}

const FILTER = [
  { id: 'tous', label: 'Tous' },
  { id: 'mes', label: 'Mes replays' },
  { id: 'recents', label: 'Récents' },
];

const REPLAYS = [
  { title: 'Physique – Chapitre 2', prof: 'Prof. Manikongo', d: '58:20', subject: 'PHYSIQUE' },
  { title: 'Chimie – Acides & bases', prof: 'Prof. Nguema', d: '1:05:20', subject: 'CHIMIE' },
  { title: 'Maths – Suites (révision)', prof: 'Prof. Kabasele', d: '42:10', subject: 'MATHS' },
];

function ReplaysFilterBar({ value, onChange }) {
  return (
    <div
      className="mb-4 flex gap-1.5 rounded-[14px] border p-1"
      style={{
        borderColor: 'rgba(165, 180, 252, 0.18)',
        background: 'linear-gradient(180deg, rgba(22, 24, 40, 0.85) 0%, rgba(10, 10, 20, 0.92) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 14px -6px rgba(0,0,0,0.45)',
      }}
    >
      {FILTER.map((x) => {
        const on = value === x.id;
        return (
          <button
            key={x.id}
            type="button"
            onClick={() => onChange(x.id)}
            className={cn('min-w-0 flex-1 rounded-[10px] py-2.5 text-center text-[12.5px] font-semibold', on ? 'text-white' : 'text-white/50')}
            style={
              on
                ? {
                    background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5E4BFF 50%, #4F46E5 100%)`,
                    boxShadow: [
                      '0 0 0 1px rgba(255,255,255,0.12)',
                      '0 4px 18px -4px rgba(99, 102, 241, 0.45)',
                      EV_SH.tab,
                    ].join(', '),
                  }
                : { background: 'rgba(0,0,0,0.2)' }
            }
          >
            {x.label}
          </button>
        );
      })}
    </div>
  );
}

export default function EleveReplaysScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const unread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [f, setF] = useState('tous');

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
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Replays</h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Sessions enregistrées, reprendre où tu t’es arrêté
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                to="/formations/mes-formations"
                className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
                aria-label="Recherche"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </Link>
              <Link
                to="/formations/mes-formations"
                className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
                aria-label="Filtres"
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </Link>
            </div>
          </div>

          <ReplaysFilterBar value={f} onChange={setF} />

        <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.2em] text-indigo-200/50">À continuer</p>
        <Link
          to="/formations/mes-formations"
          className="relative mb-5 block overflow-hidden"
          style={{ borderRadius: EV_R.lg, ...continueCardSurface() }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-4 h-24 w-24 rounded-full opacity-45 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, transparent 70%)' }}
          />
          <div className="relative aspect-[16/9] w-full">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, #1a0a2e 0%, #312e81 40%, #0f172a 100%)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_32px_-8px_rgba(99,102,241,0.5)] backdrop-blur-sm">
                <Play className="ml-0.5 h-7 w-7 fill-white text-white" />
              </span>
            </div>
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
              <span className="rounded-md border border-white/10 bg-black/50 px-2 py-0.5 font-mono text-[10.5px] text-white/95">
                1:24:15
              </span>
              <span
                className="rounded border border-violet-400/35 px-1.5 py-0.5 text-[7.5px] font-extrabold tracking-[0.1em] text-violet-200/95"
                style={{ background: 'rgba(123, 97, 255, 0.25)' }}
              >
                PHYSIQUE
              </span>
            </div>
          </div>
          <div className="relative p-3.5">
            <p className="text-[15px] font-bold leading-tight text-white">Ondes et lumière – Chapitre 3</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: EV_MUTED }}>
              Prof. Manikongo
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: '45%', background: `linear-gradient(90deg, ${EV_ACCENT}, #a78bfa)` }}
              />
            </div>
          </div>
        </Link>

        <EleveSectionTitle className="mb-2.5" action="Voir tout" actionTo="/formations/mes-formations" actionClassName="!text-violet-400">
          Tous les replays
        </EleveSectionTitle>
        <div className="space-y-2.5">
          {REPLAYS.map((r, i) => (
            <div
              key={r.title}
              className="flex items-stretch gap-2.5 p-2 transition active:scale-[0.99]"
              style={{ borderRadius: EV_R.md, ...replayRowSurface(i) }}
            >
              <div
                className="relative h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-[12px] border"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  background: 'linear-gradient(145deg, #1e1b4b, #312e81)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-6 w-6 fill-white/80 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="line-clamp-1 text-[13.5px] font-semibold text-white">{r.title}</p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: EV_MUTED }}>
                  {r.prof}
                </p>
                <p className="mt-1 text-[10.5px] font-mono tabular-nums" style={{ color: EV_MUTED }}>
                  {r.d}
                </p>
              </div>
              <div className="flex flex-col items-end justify-between py-0.5">
                <span className="max-w-[3.5rem] shrink-0 rounded border border-violet-500/30 bg-violet-500/8 px-1 py-0.5 text-center text-[6.5px] font-extrabold leading-tight text-violet-200/95">
                  {r.subject}
                </span>
                <button type="button" className="p-1 text-white/35" aria-label="Options">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
