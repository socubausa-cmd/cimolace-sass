/** Préférence locale : forcer la maquette LIRI « mobile » même sur grand écran. */
export const LIRI_FORCE_COMPACT_LAYOUT_KEY = 'liri-force-compact-layout-v1';

export function readLiriForceCompactLayout() {
  try {
    return localStorage.getItem(LIRI_FORCE_COMPACT_LAYOUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLiriForceCompactLayout(value) {
  try {
    if (value) localStorage.setItem(LIRI_FORCE_COMPACT_LAYOUT_KEY, '1');
    else localStorage.removeItem(LIRI_FORCE_COMPACT_LAYOUT_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('liri-force-compact-layout'));
  }
}
