import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SmartboardRichSlide from './SmartboardRichSlide';
import { buildDeckFromMindmap } from '@/lib/smartboard/buildDeckFromMindmap';

/**
 * Deck SmartBoard CÔTÉ ÉLÈVE (lecture seule). « carte = slide » — chaque carte est
 * rendue comme une slide pédagogique premium (SmartboardRichSlide, style référence).
 *
 * variant 'overlay' → tableau interactif superposé sur la vidéo (densité compacte, scrollable).
 * variant 'panel'   → slide pleine (densité full) sous la vidéo / mobile / salle de révision.
 */
export default function StudentSmartboardDeck({
  mindmap,
  chapters = [],
  currentTime = 0,
  onSeek,
  syncToVideo = true,
  variant = 'panel',
  panelHeightClass = '', // conservé pour compat appelants (non utilisé : la slide gère sa hauteur)
  className = '',
}) {
  const deck = useMemo(() => buildDeckFromMindmap(mindmap, chapters), [mindmap, chapters]);
  const slides = deck.slides;
  const hasTimes = useMemo(() => slides.some((s) => Number.isFinite(Number(s?.timeSeconds))), [slides]);

  const timeIdx = useMemo(() => {
    if (!syncToVideo || !hasTimes || !slides.length) return 0;
    let idx = 0;
    for (let i = 0; i < slides.length; i += 1) {
      const t = Number(slides[i]?.timeSeconds);
      if (Number.isFinite(t) && currentTime + 0.25 >= t) idx = i;
    }
    return idx;
  }, [syncToVideo, hasTimes, slides, currentTime]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (syncToVideo && hasTimes) setIdx(timeIdx);
  }, [syncToVideo, hasTimes, timeIdx]);
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  if (!slides.length) return null;

  const safe = Math.min(idx, slides.length - 1);
  const cur = slides[safe];

  const go = (i) => {
    const j = Math.max(0, Math.min(slides.length - 1, i));
    setIdx(j);
    const t = Number(slides[j]?.timeSeconds);
    if (onSeek && Number.isFinite(t)) onSeek(t);
  };

  const progress = slides.length > 1 ? (safe / (slides.length - 1)) * 100 : 0;
  const compact = variant === 'overlay';

  const nav = (
    <div className="flex items-center gap-3 px-3 py-2" style={{ background: '#0a0e16', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        type="button"
        onClick={() => go(safe - 1)}
        disabled={safe <= 0}
        className="shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Carte précédente"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[var(--school-accent)] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-[11px] font-mono text-gray-400 tabular-nums">{safe + 1}/{slides.length}</span>
      </div>
      <button
        type="button"
        onClick={() => go(safe + 1)}
        disabled={safe >= slides.length - 1}
        className="shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Carte suivante"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className={`flex flex-col overflow-hidden ${compact ? 'h-full rounded-xl shadow-2xl' : 'rounded-2xl'} ${className}`}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SmartboardRichSlide
          card={cur}
          slide={cur.slideContent}
          density={compact ? 'compact' : 'full'}
          chapterNum={safe + 1}
          time={cur.time}
        />
      </div>
      {slides.length > 1 ? nav : null}
    </div>
  );
}
