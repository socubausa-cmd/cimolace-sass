import React from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sumSlideTimingMinutes } from '../lib/liriSlideTiming';

/** @param {string} band */
function miniScoreChipClass(band) {
  switch (band) {
    case 'faible':
      return 'border-red-500/35 bg-red-950/40 text-red-200/95';
    case 'moyen':
      return 'border-amber-500/35 bg-amber-950/35 text-amber-100/90';
    case 'bon':
      return 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100/95';
    case 'excellent':
      return 'border-[#D4AF37]/40 bg-[#1a1810] text-[#f5dd8a]';
    default:
      return 'border-white/12 bg-white/[0.06] text-white/45';
  }
}

/**
 * Barre inférieure : parcours des fiches SmartBoard (Copilot), filmstrip + navigation.
 * @param {{
 *   slideScores?: import('../lib/computeSmartboardQualityScore').SmartboardQualityResult[] | null;
 *   slideTimingMinutes?: number[] | null;
 *   onSlideTimingChange?: (index: number, minutes: number | string) => void;
 *   recommendedDurationMinutes?: number | null;
 *   onAddScene?: () => void;
 * }} props
 */
export default function SmartboardFilmstripBar({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onPrev,
  onNext,
  slideScores = null,
  slideTimingMinutes = null,
  onSlideTimingChange,
  recommendedDurationMinutes = null,
  onAddScene,
  className,
}) {
  if (!slides?.length) return null;

  const total = slides.length;
  const current = slides[activeSlideIndex];
  const title = current?.title?.trim() || `Slide ${activeSlideIndex + 1}`;
  const timingArr = Array.isArray(slideTimingMinutes) ? slideTimingMinutes : [];
  const activeMin = timingArr[activeSlideIndex];
  const sumPlan = sumSlideTimingMinutes(timingArr);
  const rec = Number(recommendedDurationMinutes);
  const timingDelta =
    Number.isFinite(rec) && rec > 0 ? Math.round((sumPlan - rec) * 10) / 10 : null;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-3 border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-white/55">
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
              Navigation des slides
            </p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-white/92">
              <span className="font-mono text-[#e9bf72]/95">
                {activeSlideIndex + 1} / {total}
              </span>
              <span className="mx-2 text-white/25">—</span>
              <span className="text-white/88">{title}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {typeof onSlideTimingChange === 'function' ? (
            <label className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/30 px-2 py-1.5 text-[10px] text-white/80">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/85" strokeWidth={2} />
              <span className="text-white/45">Fiche</span>
              <input
                type="number"
                min={0.5}
                max={480}
                step={0.5}
                value={activeMin ?? ''}
                onChange={(e) => onSlideTimingChange(activeSlideIndex, e.target.value)}
                className="w-14 rounded border border-white/15 bg-[#0a0c14] px-1 py-0.5 font-mono text-[11px] text-white/92"
                title="Durée prévue pour cette fiche (minutes)"
              />
              <span className="text-white/45">min</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={onPrev}
            disabled={activeSlideIndex <= 0}
            className="inline-flex items-center gap-1 rounded-lg border border-white/14 bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Slide précédent"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={activeSlideIndex >= total - 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-300/[0.12] px-4 py-2 text-[11px] font-semibold text-amber-50 shadow-[0_0_20px_rgba(212,175,55,0.1)] transition-colors hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Slide suivant"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {slides.map((s, i) => {
          const q = slideScores?.[i];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSlide(i)}
              title={q ? `Score plan fiche ${i + 1} : ${q.score} (${q.labelFr})` : s.title}
              className={cn(
                'flex w-[min(260px,72vw)] shrink-0 flex-col gap-1.5 rounded-2xl border p-3 text-left transition-all',
                i === activeSlideIndex
                  ? 'border-amber-300/45 bg-amber-300/10 text-amber-50 shadow-[0_0_20px_rgba(253,224,71,0.08)]'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.07]',
              )}
            >
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
                Slide {i + 1}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white/90">{s.title}</p>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="rounded-lg border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] text-white/50">
                  Plan Copilot
                </span>
                {q ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-lg border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none',
                      miniScoreChipClass(q.band),
                    )}
                  >
                    {q.score}%
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
        {typeof onAddScene === 'function' ? (
          <button
            type="button"
            onClick={onAddScene}
            className="flex h-[min(140px,22vh)] w-[120px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-[11px] text-white/45 transition-colors hover:border-amber-300/30 hover:bg-white/[0.05] hover:text-amber-200/80"
          >
            + Nouvelle scène
          </button>
        ) : null}
      </div>
      <p className="text-[9px] text-white/32">
        {typeof onSlideTimingChange === 'function' ? (
          <>
            Σ durées plan :{' '}
            <span className="font-mono text-white/55">{sumPlan ? Math.round(sumPlan * 10) / 10 : '—'}</span> min
            {Number.isFinite(rec) && rec > 0 ? (
              <>
                {' '}
                · reco. analyse :{' '}
                <span className="font-mono text-white/55">{rec}</span> min
                {timingDelta !== null && Math.abs(timingDelta) > 0.05 ? (
                  <span className={timingDelta > 0 ? ' text-amber-200/90' : ' text-cyan-200/85'}>
                    {' '}
                    ({timingDelta > 0 ? '+' : ''}
                    {timingDelta})
                  </span>
                ) : null}
              </>
            ) : null}
            <span className="text-white/25"> · </span>
          </>
        ) : null}
        Chaque scène Konva couvre le design ; la navigation pilote le plan Copilot. Le nombre sur chaque fiche = score
        heuristique (script + canvas partagé).
      </p>
    </div>
  );
}
