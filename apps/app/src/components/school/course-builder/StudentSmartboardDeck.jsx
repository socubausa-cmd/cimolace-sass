import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [dir, setDir] = useState(1); // sens d'animation : 1 = avant, -1 = arrière
  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (syncToVideo && hasTimes) setIdx(timeIdx);
  }, [syncToVideo, hasTimes, timeIdx]);
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const safe = slides.length ? Math.min(idx, slides.length - 1) : 0;
  const cur = slides[safe];

  const go = useCallback((i) => {
    if (!slides.length) return;
    const j = Math.max(0, Math.min(slides.length - 1, i));
    setDir(j >= safe ? 1 : -1);
    setIdx(j);
    const t = Number(slides[j]?.timeSeconds);
    if (onSeek && Number.isFinite(t)) onSeek(t);
  }, [slides, safe, onSeek]);

  // Plein écran (API navigateur) sur le conteneur du deck — présentation façon Gamma.
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el || typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onFs = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => {
    if (!isFs || typeof window === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(safe + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(safe - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFs, go, safe]);

  if (!slides.length) return null;

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
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFs ? 'Quitter le plein écran (Échap)' : 'Plein écran — présentation (← → pour naviguer)'}
        aria-label="Plein écran"
        className="shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`flex flex-col overflow-hidden ${isFs ? 'h-screen w-screen bg-[#0a0e16]' : compact ? 'h-full rounded-xl shadow-2xl' : 'rounded-2xl'} ${className}`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto relative">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={safe}
            custom={dir}
            initial={{ opacity: 0, x: dir >= 0 ? 48 : -48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir >= 0 ? -48 : 48 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <SmartboardRichSlide
              card={cur}
              slide={cur.slideContent}
              density={compact ? 'compact' : 'full'}
              chapterNum={safe + 1}
              time={cur.time}
            />
          </motion.div>
        </AnimatePresence>
      </div>
      {slides.length > 1 ? nav : null}
    </div>
  );
}
