/**
 * LIRI SmartBoard IA — moteur d’édition intelligent (façade + domaines).
 *
 * Modules (spec produit) :
 * - Stroke Engine : capture → neuroInk (`applyNeuroInkToFreePoints`)
 * - Shape Recognition : cercle, rectangle, triangle, flèche… (modes croquis)
 * - Handwriting AI : lissage sans snap géométrique (modes écriture)
 * - Layout / Speech / Assistant : voir `liriSmartboardSpeechAssist` et couches futures
 *
 * Séparation stricte **écriture** vs **croquis** : évite O/cercle, 0/cercle en désactivant
 * la détection de formes fermées en mode manuscrit.
 */

import {
  NEURO_INK_MODE,
  applyNeuroInkToFreePoints,
  defaultNeuroInkSettings,
} from '@/lib/neuroInk';

export { NEURO_INK_MODE, applyNeuroInkToFreePoints, defaultNeuroInkSettings };

/** Domaine d’édition au crayon (prioritaire sur les cases NeuroInk conflictuelles). */
export const LIRI_INK_EDIT_DOMAIN = {
  /** Lettres / mots — pas de snap cercle-carré sur les boucles */
  HANDWRITING: 'handwriting',
  /** Géométrie — détection cercle, triangle, rectangle, flèche… */
  SKETCH: 'sketch',
};

/** Niveau d’assistance (UI + extensions futures). */
export const LIRI_IA_ASSIST_LEVEL = {
  MANUAL: 'manual',
  ASSISTED: 'assisted',
  AUTO: 'auto',
};

/**
 * Fusionne les réglages NeuroInk avec le domaine LIRI (écriture vs croquis).
 * @param {ReturnType<typeof defaultNeuroInkSettings>} base
 * @param {string} domain — `LIRI_INK_EDIT_DOMAIN.*`
 */
export function mergeNeuroInkWithDomain(base, domain) {
  if (!base || typeof base !== 'object') return defaultNeuroInkSettings();
  if (domain === LIRI_INK_EDIT_DOMAIN.HANDWRITING) {
    return {
      ...base,
      mode: NEURO_INK_MODE.ASSISTED,
      shapeDetection: false,
    };
  }
  if (domain === LIRI_INK_EDIT_DOMAIN.SKETCH) {
    return {
      ...base,
      mode: NEURO_INK_MODE.SHAPES,
      shapeDetection: true,
      snapStraight: base.snapStraight !== false,
    };
  }
  return base;
}

/**
 * ⌃ ou ⌘ enfoncé pendant le geste — utilisé pour « ligne parfaite » (segment début→fin).
 */
export function isStraightLineModifier(e) {
  if (!e) return false;
  return Boolean(e.ctrlKey || e.metaKey);
}

export { filterStrokesOutsideNormRect } from '@/lib/liriSmartboardStrokeHitTest';
export { buildPresetNormStroke } from '@/lib/liriSmartboardPresetShapes';
export { analyzePedagogyTranscript } from '@/lib/liriSmartboardSpeechHeuristics';
export {
  LIRI_PEDAGOGY_HINTS_QUEUE_KEY,
  readPedagogyHintsQueue,
  clearPedagogyHintsQueue,
  buildKonvaObjectsFromPedagogyHints,
} from '@/lib/liriPedagogyHintsKonvaBridge';
