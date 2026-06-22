import { useEffect, useState } from 'react';

/**
 * Live LIRI : UI mobile dédiée (maquette, scènes, SmartBoard tactile).
 * Seuil aligné sous `xl` Tailwind (1280px) pour inclure tablettes et éviter
 * les écarts matchMedia / barre d'URL Chrome mobile (visualViewport).
 */
export const LIRI_MOBILE_MAX_CSS_PX = 1279;

/** Arène live studio : maquette tactile en dessous de `lg` Tailwind (1024px) pour garder la grille 3 colonnes sur tablette / fenêtre réduite. */
export const LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX = 1023;

/**
 * Navigateur web live : au-delà de cette largeur la grille 3 colonnes (rails + plateau) est prévue ;
 * en dessous ou égal → layout compact empilé pour éviter le débordement horizontal.
 * Abaissé à 1024 (lg) : les rails repliés sont désormais de fines poignées 52px (façon maquette),
 * donc la grille 3 colonnes tient dès les laptops (~1024-1536) → l'arène desktop + le chrome
 * (barre du haut membres) s'affichent au lieu de la maquette mobile.
 */
export const LIRI_LIVE_WEB_THREE_COL_MAX_CSS_PX = 1024;

export function layoutWidthPx() {
  if (typeof window === 'undefined') return LIRI_MOBILE_MAX_CSS_PX + 1;
  const vv = window.visualViewport;
  if (vv && Number.isFinite(vv.width) && vv.width > 0) return vv.width;
  return window.innerWidth;
}

/**
 * Viewport au plus `maxCssPx` de large (même logique visualViewport que le live LIRI).
 */
export function useViewportWidthAtMost(maxCssPx) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? layoutWidthPx() <= maxCssPx : false,
  );

  useEffect(() => {
    const update = () => setMatches(layoutWidthPx() <= maxCssPx);
    update();
    window.addEventListener('resize', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, [maxCssPx]);

  return matches;
}

/**
 * Compact si la largeur du viewport CSS est ≤ maxCssPx (media query standard).
 * Préférer ceci sur le **navigateur** pour l'arène : `visualViewport` peut sous-estimer
 * la largeur (zoom, barres UI) et laisser l'UI « mobile » sur un bureau web.
 */
export function useMatchMediaAtMost(maxCssPx) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${maxCssPx}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxCssPx}px)`);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [maxCssPx]);

  return matches;
}

export function useLiriMobileBreakpoint() {
  return useViewportWidthAtMost(LIRI_MOBILE_MAX_CSS_PX);
}
