import { useEffect, useState } from 'react';
import { useLiriCompactLiveUiState } from '@/hooks/useLiriCompactLiveUiState';
import {
  LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX,
  LIRI_LIVE_WEB_THREE_COL_MAX_CSS_PX,
  useMatchMediaAtMost,
} from '@/hooks/useLiriMobileBreakpoint';

/**
 * Breakpoints viewport pour la grille live (compact invité, largeur seule hôte,
 * desktop étroit, seuil 3 colonnes web).
 */
export function useLiveHostViewportBreakpoints() {
  const { compact: lhCompactViewportRaw } = useLiriCompactLiveUiState({
    compactBelowWidthPx: LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX,
    useMatchMediaBreakpoint: true,
  });

  const [lhCompactByWidthOnly, setLhCompactByWidthOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setLhCompactByWidthOnly(window.innerWidth <= LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [lhNarrowDesktop, setLhNarrowDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1440;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setLhNarrowDesktop(window.innerWidth <= 1440);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const lhWebTooNarrowForThreeCols = useMatchMediaAtMost(LIRI_LIVE_WEB_THREE_COL_MAX_CSS_PX);

  return {
    lhCompactViewportRaw,
    lhCompactByWidthOnly,
    lhNarrowDesktop,
    lhWebTooNarrowForThreeCols,
  };
}
