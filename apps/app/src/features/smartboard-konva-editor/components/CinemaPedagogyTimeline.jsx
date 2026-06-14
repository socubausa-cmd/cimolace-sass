import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Frise proportionnelle aux durées des prises (ordre slide → horodatage).
 *
 * @param {{
 *   takes: import('../lib/liriCinemaPedagogy').LiriCinemaPedagogyTake[];
 *   activeSlideIndex: number;
 *   onPickTake: (takeId: string) => void;
 * }} props
 */
export default function CinemaPedagogyTimeline({ takes, activeSlideIndex, onPickTake }) {
  const sorted = useMemo(() => {
    return [...(takes || [])].sort((a, b) => {
      if (a.slideIndex !== b.slideIndex) return a.slideIndex - b.slideIndex;
      return String(a.recordedAt || '').localeCompare(String(b.recordedAt || ''));
    });
  }, [takes]);

  const totalSec = useMemo(
    () => sorted.reduce((acc, t) => acc + Math.max(0, Number(t.durationSec) || 0), 0),
    [sorted],
  );

  const denom = useMemo(() => Math.max(totalSec, 0.001), [totalSec]);

  if (!sorted.length) return null;

  return (
    <div className="rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] bg-black/25 px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] text-white/40">
        <span>Timeline — ordre slides</span>
        <span className="tabular-nums">{totalSec.toFixed(1)} s total</span>
      </div>
      <div className="flex h-7 w-full gap-px overflow-hidden rounded-md bg-white/[0.06]">
        {sorted.map((t, i) => {
          const d = Math.max(0, Number(t.durationSec) || 0);
          const pct = denom > 0 ? (d / denom) * 100 : 100 / sorted.length;
          const active = t.slideIndex === activeSlideIndex;
          return (
            <button
              key={t.id}
              type="button"
              title={`Slide ${t.slideIndex + 1} · ${d.toFixed(1)} s${t.hasRecording ? ' · vidéo' : ''}`}
              onClick={() => onPickTake(t.id)}
              style={{ width: `${pct}%`, minWidth: '8px' }}
              className={cn(
                'flex items-center justify-center text-[9px] font-semibold tabular-nums transition-opacity hover:opacity-100',
                active
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-white shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]'
                  : 'bg-violet-500/35 text-white/85',
                !active && i % 2 === 1 && 'bg-indigo-500/35',
              )}
            >
              {t.slideIndex + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
