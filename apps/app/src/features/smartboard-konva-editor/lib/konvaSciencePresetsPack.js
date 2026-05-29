/**
 * LIRI Konva Science Pack V1 — presets + éléments + mises en page (recettes).
 */
import meta from '../data/liri-konva-science-v1/meta.json';
import tokens from '../data/liri-konva-science-v1/tokens.json';
import presetsBatch1 from '../data/liri-konva-science-v1/presets-batch-1.json';
import presetsBatch2 from '../data/liri-konva-science-v1/presets-batch-2.json';
import presetsBatch3 from '../data/liri-konva-science-v1/presets-batch-3.json';
import presetsBatch4 from '../data/liri-konva-science-v1/presets-batch-4.json';
import elementsBatch1 from '../data/liri-konva-science-v1/elements-batch-1.json';
import elementsBatch2 from '../data/liri-konva-science-v1/elements-batch-2.json';
import starterLayouts from '../data/liri-konva-science-v1/starterLayouts.json';
import { packPresetToSceneObjects } from './konvaProPresetsPackV1';

/** @type {Array<{ id: string; label: string }>} */
export const LIRI_KONVA_SCIENCE_DISCIPLINES = [
  { id: 'biology', label: 'Biologie' },
  { id: 'physics', label: 'Physique' },
  { id: 'chemistry', label: 'Chimie' },
  { id: 'earth', label: 'Sciences de la Terre' },
  { id: 'method', label: 'Méthode scientifique' },
];

/** Catégories d'éléments → libellés UI */
export const LIRI_KONVA_SCIENCE_ELEMENT_CATEGORY_LABELS = {
  arrows: 'Flèches',
  markers: 'Repères',
  labels: 'Étiquettes',
  graphs: 'Graphiques',
  cycles: 'Cycles',
  tables: 'Tableaux',
  flow: 'Flux',
  earth: 'Terre',
  method: 'Méthode',
  callouts: 'Callouts',
  summary: 'Synthèse',
  formula: 'Formules',
};

const sciencePresets = [
  ...presetsBatch1,
  ...presetsBatch2,
  ...presetsBatch3,
  ...presetsBatch4,
];

const scienceElements = [...elementsBatch1, ...elementsBatch2];

export const LIRI_KONVA_SCIENCE_PRESETS_PACK = {
  meta,
  tokens,
  sciencePresets,
  scienceElements,
  starterLayouts,
};

/**
 * @param {string} id
 */
export function findSciencePresetById(id) {
  return sciencePresets.find((p) => p.id === id) || null;
}

/**
 * @param {string} id
 */
export function findScienceElementById(id) {
  return scienceElements.find((p) => p.id === id) || null;
}

/**
 * @param {string} id
 */
export function findScienceStarterLayoutById(id) {
  return starterLayouts.find((p) => p.id === id) || null;
}

/**
 * @param {string} disciplineId
 */
export function listSciencePresetsByDiscipline(disciplineId) {
  if (!disciplineId) return sciencePresets;
  return sciencePresets.filter((p) => p.discipline === disciplineId);
}

/**
 * @param {string} categoryId
 */
export function listScienceElementsByCategory(categoryId) {
  if (!categoryId) return scienceElements;
  return scienceElements.filter((p) => p.category === categoryId);
}

/** @param {{ nodes?: unknown[] }} preset */
export function sciencePresetToSceneObjects(preset) {
  return packPresetToSceneObjects(preset);
}

/**
 * @param {string} layoutId
 * @returns {import('../model/sceneTypes').SbKonvaObjectBase[]}
 */
export function scienceStarterLayoutToSceneObjects(layoutId) {
  const layout = findScienceStarterLayoutById(layoutId);
  if (!layout?.recipe?.length) return [];
  const out = [];
  for (const refId of layout.recipe) {
    const preset = findSciencePresetById(refId);
    const el = findScienceElementById(refId);
    const pack = preset || el;
    if (pack) out.push(...packPresetToSceneObjects(pack));
  }
  return out;
}

/** @deprecated Utiliser listSciencePresetsByDiscipline */
export function listSciencePresetsByFamily(familyId) {
  return listSciencePresetsByDiscipline(familyId);
}
