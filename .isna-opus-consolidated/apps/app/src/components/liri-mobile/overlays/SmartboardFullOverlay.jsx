import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { cn } from '@/lib/utils';

const SWIPE_DOWN_CLOSE_PX = 64;

/**
 * @param {{ plan?: { label: string, human: string, empty?: boolean, title?: string } | null, sceneCaption?: string }} props
 */
export function SmartboardFullOverlay({ plan = null, sceneCaption = '' }) {
  const closeOverlay = useMobileLiriStore((s) => s.closeOverlay);
  const caption = String(sceneCaption || '').trim();
  const fullTitle = [plan?.label, plan?.human, caption].filter(Boolean).join(' · ');
  const swipeStartY = useRef(null);

  const onSwipeDownStart = useCallback((e) => {
    swipeStartY.current = e.touches[0].clientY;
  }, []);

  const onSwipeDownEnd = useCallback(
    (e) => {
      if (swipeStartY.current == null) return;
      const dy = e.changedTouches[0].clientY - swipeStartY.current;
      swipeStartY.current = null;
      if (dy > SWIPE_DOWN_CLOSE_PX) closeOverlay();
    },
    [closeOverlay],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-0 z-[205]"
    >
      <button
        type="button"
        aria-label="Quitter le mode plein écran"
        onClick={closeOverlay}
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
      />

      {/* Poignée centrale : tap ou glisser vers le bas pour réduire (sans gêner le plateau) */}
      <button
        type="button"
        aria-label="Réduire l’écran intelligent — glisser vers le bas ou toucher"
        title="Glisser vers le bas ou toucher pour réduire"
        onClick={closeOverlay}
        onTouchStart={onSwipeDownStart}
        onTouchEnd={onSwipeDownEnd}
        className="pointer-events-auto absolute left-1/2 top-[max(0.35rem,env(safe-area-inset-top))] z-[3] flex -translate-x-1/2 flex-col items-center gap-1.5 rounded-2xl border-0 bg-transparent px-6 py-2 active:opacity-80"
        data-liri-no-doubletap
      >
        <span className="h-1 w-10 rounded-full bg-[#c9a962]/50 shadow-[0_0_12px_rgba(201,169,98,0.25)]" aria-hidden />
      </button>

      <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={closeOverlay}
          title="Toucher pour réduire la vue cours"
          aria-label="Réduire l’écran intelligent — revenir à la vue cours"
          className="pointer-events-auto flex min-w-0 max-w-[min(100%,calc(100vw-5.5rem))] items-center gap-2 rounded-full border border-[#c9a962]/35 bg-[#0a0806]/88 px-3 py-1.5 text-left font-serif text-[11px] text-[#e8d4a8]/95 shadow-[0_0_24px_-8px_rgba(201,169,98,0.35)] backdrop-blur-md transition-transform active:scale-[0.98]"
          data-liri-no-doubletap
        >
          <Maximize2 className="h-3.5 w-3.5 shrink-0 text-[#c9a962]" aria-hidden />
          <span className="truncate">Écran intelligent — plein cadre</span>
        </button>
        <button
          type="button"
          onClick={closeOverlay}
          className="pointer-events-auto z-[2] flex h-10 w-10 items-center justify-center rounded-full border border-[#c9a962]/30 bg-[#0a0806]/88 text-[#e8d4a8] shadow-[0_0_20px_-10px_rgba(201,169,98,0.25)] backdrop-blur-md"
          aria-label="Quitter le plein écran"
          data-liri-no-doubletap
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {plan ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col items-center justify-end bg-gradient-to-t from-black/45 via-black/15 to-transparent px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-10">
          <button
            type="button"
            onClick={closeOverlay}
            title="Toucher pour réduire la vue cours"
            aria-label={`Réduire — ${fullTitle}`}
            className={cn(
              'pointer-events-auto max-w-[min(100%,440px)] truncate rounded-full border border-[#c9a962]/28 bg-[#0a0806]/92 px-3 py-1.5 text-center font-serif text-[10px] leading-snug text-[#c9a962]/90 shadow-[0_0_20px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform active:scale-[0.98]',
              plan.empty && 'text-[#c9a962]/75',
            )}
            data-liri-no-doubletap
          >
            <span className="font-semibold uppercase tracking-[0.1em] text-[#c9a962]/80">{plan.label}</span>
            <span className="mx-1 text-[#c9a962]/40">·</span>
            <span className="tabular-nums">{plan.human}</span>
            {caption ? (
              <>
                <span className="mx-1 text-[#c9a962]/40">·</span>
                <span className="text-[#e8d4a8]/88">{caption}</span>
              </>
            ) : null}
          </button>
          <span className="pointer-events-none mt-1 text-center text-[9px] text-[#c9a962]/45">
            Toucher pour réduire
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}
