import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Mic2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { useSceneAudio } from './useSceneAudio';

const stateLabel = {
  idle: 'Prêt',
  loading: 'Chargement…',
  playing: 'Lecture',
  fading: 'Fondu…',
  paused: 'Pause',
  stopped: 'Arrêté',
  error: 'Erreur',
};

/**
 * @param {{
 *   scenes: import('./scene-types').AudioScene[];
 *   className?: string;
 *   defaultCollapsed?: boolean;
 *   initialSceneIndex?: number;
 *   sessionKey?: string | null;
 *   onSceneIndexChange?: (index: number) => void;
 * }} props
 */
export function AudioScenePanel({
  scenes,
  className,
  defaultCollapsed = false,
  initialSceneIndex,
  sessionKey,
  onSceneIndexChange,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [master, setMaster] = useState(1);
  const [playbackFactor, setPlaybackFactor] = useState(1);

  const {
    currentScene,
    nextScene,
    event,
    index,
    playAtIndex,
    playCurrent,
    next,
    previous,
    pause,
    resume,
    stop,
    duck,
    restore,
    setMasterVolume,
    setScenePlaybackFactor,
    engineState,
  } = useSceneAudio(scenes, {
    initialIndex: initialSceneIndex,
    sessionKey: sessionKey ?? null,
    onIndexChange: onSceneIndexChange,
  });

  useEffect(() => {
    setPlaybackFactor(1);
  }, [index]);

  if (!scenes.length) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50 backdrop-blur-md',
          className,
        )}
      >
        Aucune scène audio configurée.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[#070a10]/90 p-4 text-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--school-accent)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
            LIRI Audio Scenes
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-[10px] text-white/45 hover:text-white/80"
        >
          {collapsed ? 'Déplier' : 'Replier'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mb-3 max-h-[min(28vh,200px)] space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/25 p-2">
            <div className="px-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">Scènes</div>
            {scenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void playAtIndex(i)}
                className={cn(
                  'w-full rounded-lg px-2 py-1.5 text-left text-[11px] transition',
                  i === index
                    ? 'bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] text-[#f5dd8a]'
                    : 'text-white/75 hover:bg-white/[0.06]',
                )}
              >
                <span className="tabular-nums text-white/40">{i + 1}.</span> {s.name}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Scène en cours</div>
              <div className="truncate text-lg font-semibold text-[#f5dd8a]">
                {currentScene?.name ?? '—'}
              </div>
              <div className="mt-1 text-[10px] text-white/40">
                État :{' '}
                <span className="text-emerald-300/90">{stateLabel[engineState] ?? engineState}</span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Suivante</div>
              <div className="truncate text-sm text-white/85">{nextScene?.name ?? '—'}</div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] hover:bg-white/10"
              onClick={() => void previous()}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Préc.
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] px-3 text-[11px] font-semibold text-black hover:bg-[var(--school-accent)]"
              onClick={() => void playCurrent()}
            >
              <Play className="h-3.5 w-3.5" /> Lancer
            </button>
            {/* Transport gaté par l'état réel du moteur — plus de clics morts. */}
            <button
              type="button"
              disabled={engineState !== 'playing'}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
              onClick={() => pause()}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
            <button
              type="button"
              disabled={engineState !== 'paused'}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
              onClick={() => void resume()}
            >
              Reprendre
            </button>
            <button
              type="button"
              disabled={engineState !== 'playing' && engineState !== 'paused'}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
              onClick={() => stop()}
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] hover:bg-white/10"
              onClick={() => void next()}
            >
              Suiv. <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-3 text-[11px] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]"
              onClick={() => duck()}
            >
              <Mic2 className="h-3.5 w-3.5" /> Ducking
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[11px] hover:bg-white/10"
              onClick={() => restore()}
            >
              Restaurer volume scène
            </button>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/45">
              Volume global
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={master}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaster(v);
                setMasterVolume(v);
              }}
              className="h-1.5 w-full accent-[var(--school-accent)]"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/45">
              Volume scène (× rapport au réglage de la scène)
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.02}
              value={playbackFactor}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPlaybackFactor(v);
                setScenePlaybackFactor(v);
              }}
              className="h-1.5 w-full accent-[var(--school-accent)]"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-3 font-mono text-[10px] leading-relaxed text-white/55">
            <div>
              Événement : <span className="text-white/80">{event?.type ?? '—'}</span>
            </div>
            <div>
              Scène : <span className="text-white/80">{event?.sceneName ?? '—'}</span>
            </div>
            {event?.details?.message ? (
              <div className="mt-1 text-amber-200/80">{String(event.details.message)}</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
