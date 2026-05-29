import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Boutons flottants pour réouvrir les rails gauche / droit quand la grille est
 * en mode compact (mobile / tablette) et qu'ils ont été repliés.
 */
export const LiveCompactRailToggles = ({
  phase,
  lhStageFocusLayout,
  lhLayoutCompact,
  liveLeftRailOpen,
  liveRightRailOpen,
  onOpenLeft,
  onOpenRight,
}) => {
  if (phase !== PHASE.LIVE || lhStageFocusLayout || !lhLayoutCompact) return null;
  return (
    <>
      {!liveLeftRailOpen ? (
        <button
          type="button"
          className="pointer-events-auto fixed z-[52] top-1/2 -translate-y-1/2 flex h-10 w-8 items-center justify-center rounded-r-lg border border-white/15 bg-[#14131c]/95 text-white/80 shadow-lg backdrop-blur-md transition hover:border-violet-400/35 hover:text-white"
          style={{ left: 'max(8px, env(safe-area-inset-left, 0px))' }}
          onClick={onOpenLeft}
          title="Afficher le panneau gauche"
          aria-label="Afficher le panneau gauche"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {!liveRightRailOpen ? (
        <button
          type="button"
          className="pointer-events-auto fixed z-[52] top-1/2 -translate-y-1/2 flex h-10 w-8 items-center justify-center rounded-l-lg border border-white/15 bg-[#14131c]/95 text-white/80 shadow-lg backdrop-blur-md transition hover:border-violet-400/35 hover:text-white"
          style={{ right: 'max(8px, env(safe-area-inset-right, 0px))' }}
          onClick={onOpenRight}
          title="Afficher le panneau droit"
          aria-label="Afficher le panneau droit"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </>
  );
};

export default LiveCompactRailToggles;
