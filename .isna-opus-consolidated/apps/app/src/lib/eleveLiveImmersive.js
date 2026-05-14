import { ELEVE_MOBILE_BASE } from '@/lib/eleveMobileRoutes';

/** @type {string} */
export const LIVE_IMMERSIVE_MODE_STORAGE_KEY = 'liri:eleve:liveImmersiveMode';

/**
 * @returns {'default' | 'alpha'}
 */
export function getStoredImmersiveMode() {
  if (typeof localStorage === 'undefined') return 'default';
  try {
    const v = localStorage.getItem(LIVE_IMMERSIVE_MODE_STORAGE_KEY);
    if (v === 'alpha' || v === 'default') return v;
  } catch {
    /* ignore */
  }
  return 'default';
}

/**
 * @param {'default' | 'alpha'} id
 */
export function setStoredImmersiveMode(id) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (id === 'alpha' || id === 'default') {
      localStorage.setItem(LIVE_IMMERSIVE_MODE_STORAGE_KEY, id);
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('liri:live-immersive-mode', { detail: { id } }));
    } catch {
      /* ignore */
    }
  }
}

/**
 * **Affichage immersif** — variantes d’UI pour la salle live côté invité (LIRI mobile).
 * L’hôte garde le pilotage des slides / smartboard sur le web ; ici on ne fait que
 * proposer des présentations différentes (référence, Alpha, …).
 */
export const IMMERSIVE_DISPLAYS = Object.freeze({
  default: {
    id: 'default',
    pathSegment: null,
    label: 'Immersif (référence)',
    description: 'Maquette de référence prédéfinie.',
  },
  alpha: {
    id: 'alpha',
    pathSegment: 'alpha',
    label: 'Immersif Alpha',
    description: 'Lecteur hôte en tête, carte pédago, carrousel chapitres, Ma vidéo + membres (maquette).',
  },
});

/**
 * URL LIRI mobile vers une variante immersif. `id` = `default` | `alpha` | …
 * @param {string} [id]
 * @returns {string}
 */
export function eleveLiveImmersivePath(id) {
  const base = `${ELEVE_MOBILE_BASE}/live/maquette`;
  if (!id || id === 'default' || id === IMMERSIVE_DISPLAYS.default.id) {
    return base;
  }
  const entry = Object.values(IMMERSIVE_DISPLAYS).find((d) => d.id === id);
  if (!entry?.pathSegment) return base;
  return `${base}/${entry.pathSegment}`;
}
