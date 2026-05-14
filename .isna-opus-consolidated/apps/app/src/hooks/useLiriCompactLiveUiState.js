import { useCallback, useEffect, useState } from 'react';
import {
  useViewportWidthAtMost,
  useMatchMediaAtMost,
  LIRI_MOBILE_MAX_CSS_PX,
} from '@/hooks/useLiriMobileBreakpoint';
import {
  LIRI_FORCE_COMPACT_LAYOUT_KEY,
  readLiriForceCompactLayout,
  writeLiriForceCompactLayout,
} from '@/lib/liriMobileLayoutPrefs';

/**
 * UI LIRI « compacte » (maquette mobile) : viewport mobile OU préférence « forcer » (localStorage).
 * Synchronisé entre onglets (storage) et dans l’onglet courant (événement après écriture).
 *
 * @param {{ compactBelowWidthPx?: number, useMatchMediaBreakpoint?: boolean }} [opts]
 *   `compactBelowWidthPx` — largeur max pour la maquette compacte (défaut 1279). Sur l’arène live,
 *   utiliser `LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX` (1023) pour afficher la grille LIRI desktop plus souvent.
 *   `useMatchMediaBreakpoint` — si true, seuil via `(max-width)` CSS (recommandé **navigateur**).
 */
export function useLiriCompactLiveUiState(opts = {}) {
  const maxW =
    Number.isFinite(opts.compactBelowWidthPx) && opts.compactBelowWidthPx > 0
      ? opts.compactBelowWidthPx
      : LIRI_MOBILE_MAX_CSS_PX;
  const viewportCompact = useViewportWidthAtMost(maxW);
  const matchMediaCompact = useMatchMediaAtMost(maxW);
  const breakpointCompact = opts.useMatchMediaBreakpoint
    ? matchMediaCompact
    : viewportCompact;
  const [forceCompact, setForceCompactState] = useState(() => readLiriForceCompactLayout());

  const setForceCompact = useCallback((next) => {
    const v = Boolean(next);
    setForceCompactState(v);
    writeLiriForceCompactLayout(v);
  }, []);

  useEffect(() => {
    const sync = () => setForceCompactState(readLiriForceCompactLayout());
    const onStorage = (e) => {
      if (e.key === LIRI_FORCE_COMPACT_LAYOUT_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('liri-force-compact-layout', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('liri-force-compact-layout', sync);
    };
  }, []);

  const compact = breakpointCompact || forceCompact;
  return { compact, forceCompact, setForceCompact };
}
