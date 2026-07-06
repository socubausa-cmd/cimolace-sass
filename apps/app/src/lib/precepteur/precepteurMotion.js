/**
 * precepteurMotion.js — HELPERS DE MOTION du lecteur Précepteur (brique D), PURS & TESTABLES.
 *
 * Source unique de l'easing `EXPO` et des variantes de transition par type de scène, plus le
 * zoom immersif « Ken Burns » du tableau. Aucune dépendance (ni React, ni framer-motion) : ce
 * sont de simples objets de props motion → testables sous `node`.
 *
 * Principes :
 *  - ENTRÉE seulement (pas d'exit) → jamais de désync avec la cadence pilotée par la voix.
 *  - `prefers-reduced-motion` (reduced=true) → simple fondu, AUCUN translate/scale/blur (obligatoire).
 *  - La révélation rehausse un contenu DÉJÀ visible (pas de gate → pas de blank en headless).
 */

// Ease-out exponentiel (cubic-bezier) — la signature motion du Précepteur.
export const EXPO = [0.16, 1, 0.3, 1];

// Dispositifs de « révélation » → entrée en « pop » (scale) pour attirer l'œil.
export const REVEAL_TYPES = new Set(['surlignage', 'encadre', 'resume_encadre']);

/**
 * Variante d'entrée d'une scène selon son type (et le respect de reduced-motion).
 * @returns {{ initial: object, animate: object, transition: object }}
 */
export function sceneVariants(type, reduced) {
  if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } };
  if (type === 'image_analogie') {
    return { initial: { x: '55%', opacity: 0, filter: 'blur(3px)' }, animate: { x: 0, opacity: 1, filter: 'blur(0px)' }, transition: { duration: 0.6, ease: EXPO } };
  }
  if (type === 'croquis') {
    // BoardSweep (§8) : balayage latéral — la surface de croquis s'ouvre depuis le côté.
    return { initial: { x: '-9%', opacity: 0, filter: 'blur(3px)' }, animate: { x: 0, opacity: 1, filter: 'blur(0px)' }, transition: { duration: 0.6, ease: EXPO } };
  }
  if (REVEAL_TYPES.has(type)) {
    return { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.45, ease: EXPO } };
  }
  if (type === 'transition') {
    return { initial: { opacity: 0, scale: 1.03 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.5, ease: EXPO } };
  }
  // leçon / amorce_croquis / atelier / défaut : montée douce.
  return { initial: { y: '4%', opacity: 0, filter: 'blur(2px)' }, animate: { y: 0, opacity: 1, filter: 'blur(0px)' }, transition: { duration: 0.45, ease: EXPO } };
}

// Zoom immersif du tableau : push-in lent et subtil (caméra qui se rapproche).
export const ZOOM_AMPLITUDE = 0.012; // +1,2 %
export const ZOOM_DURATION_S = 11;

/**
 * Props motion du push-in ambiant du tableau. Réinitialisé par scène (le wrapper porte key={idx}).
 * reduced=true → neutre (statique).
 * @returns {{ initial: object, animate: object, transition: object }}
 */
export function kenBurnsBoardZoom(reduced) {
  if (reduced) return { initial: { scale: 1 }, animate: { scale: 1 }, transition: { duration: 0 } };
  return { initial: { scale: 1 }, animate: { scale: 1 + ZOOM_AMPLITUDE }, transition: { duration: ZOOM_DURATION_S, ease: 'easeOut' } };
}

export default { EXPO, sceneVariants, kenBurnsBoardZoom, REVEAL_TYPES, ZOOM_AMPLITUDE, ZOOM_DURATION_S };
