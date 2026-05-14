/**
 * Pont LIRI Text Design ↔ presets texte Pro Konva + bibliothèque de phrases.
 * Données : `data/liri-text-design-v1/`
 */
import autoTextDesignEngine from '../data/liri-text-design-v1/auto_text_design_engine.json';
import textDesignPack from '../data/liri-text-design-v1/text_design_pack.json';
import textLibrary from '../data/liri-text-design-v1/text_library.json';
import styleToProPreset from '../data/liri-text-design-v1/liri-style-to-pro-preset.json';
import { findTextPresetById, packPresetToSceneObjects } from './konvaProPresetsPackV1';
import { mkTextObject, SB_KONVA_CANVAS_W, SB_KONVA_CANVAS_H } from '../model/sceneModel';

import coachSlideTrainingPromptRaw from '../data/liri-text-design-v1/coach_slide_training_prompt.md?raw';
import smartboardWorkflowRaw from '../data/liri-text-design-v1/smartboard_workflow.md?raw';
import eventDesignerFamiliesRaw from '../data/liri-text-design-v1/event_designer_families.md?raw';

export const LIRI_TEXT_DESIGN_ENGINE = autoTextDesignEngine;
export const LIRI_TEXT_DESIGN_STYLES = textDesignPack.textStyles || [];
export const LIRI_TEXT_LIBRARY = textLibrary;
export const LIRI_STYLE_TO_PRO_PRESET = styleToProPreset;

/** Catégorie bibliothèque de phrases → classification moteur (placement) */
export const TEXT_LIBRARY_CATEGORY_TO_CLASSIFICATION = {
  Pedagogie: 'title',
  Science: 'definition',
  Math: 'number',
  Litteraire: 'quote',
  Business: 'cta',
  Spirituel: 'spiritual_revelation',
};

/** Prompts markdown (IA / coach futur) */
export const LIRI_COACH_SLIDE_TRAINING_PROMPT = coachSlideTrainingPromptRaw;
export const LIRI_SMARTBOARD_WORKFLOW_MD = smartboardWorkflowRaw;
export const LIRI_EVENT_DESIGNER_FAMILIES_MD = eventDesignerFamiliesRaw;

const FALLBACK_PRO_TEXT_PRESET = 'text_11_body_paragraph_pro';

/**
 * @returns {string[]}
 */
export function getLiriTextStyleIds() {
  return LIRI_TEXT_DESIGN_STYLES.map((s) => s.id);
}

/**
 * @param {string} styleId — ex. title_hero
 * @returns {string | null}
 */
export function getProPresetIdForLiriStyle(styleId) {
  const mapped = LIRI_STYLE_TO_PRO_PRESET[styleId];
  if (mapped) return mapped;
  return null;
}

/**
 * Blocs Konva équivalents au style LIRI (via preset Pro texte).
 * @param {string} styleId
 * @returns {import('../model/sceneTypes').SbKonvaObjectBase[]}
 */
export function liriTextStyleToSceneObjects(styleId) {
  const proId = getProPresetIdForLiriStyle(styleId) || FALLBACK_PRO_TEXT_PRESET;
  const preset = findTextPresetById(proId);
  if (!preset) return [];
  return packPresetToSceneObjects(preset);
}

/**
 * @returns {string[]}
 */
export function getClassificationTypes() {
  return LIRI_TEXT_DESIGN_ENGINE.classification_types || [];
}

/**
 * @param {string} classification — ex. title
 * @returns {string[]}
 */
export function getStyleIdsForClassification(classification) {
  const map = LIRI_TEXT_DESIGN_ENGINE.style_map || {};
  return Array.isArray(map[classification]) ? map[classification] : [];
}

/**
 * @param {string} classification
 * @param {number} [styleIndex]
 * @returns {import('../model/sceneTypes').SbKonvaObjectBase[]}
 */
export function liriClassificationToSceneObjects(classification, styleIndex = 0) {
  const styles = getStyleIdsForClassification(classification);
  const id = styles[styleIndex];
  if (!id) return [];
  return liriTextStyleToSceneObjects(id);
}

/**
 * @param {string} classification
 * @returns {{ zones: string[]; width_ratio?: number } | null}
 */
export function getPlacementRuleForClassification(classification) {
  const rules = LIRI_TEXT_DESIGN_ENGINE.placement_rules || {};
  return rules[classification] || null;
}

/**
 * Rectangle indicatif (safe zone) pour placer un texte — heuristique 1037×750.
 * @param {string} classification
 * @param {number} [zoneIndex]
 * @returns {{ x: number; y: number; width: number; height: number } | null}
 */
export function suggestPlacementRectForClassification(classification, zoneIndex = 0) {
  const rule = getPlacementRuleForClassification(classification);
  if (!rule) return null;
  const w = Math.round(SB_KONVA_CANVAS_W * (rule.width_ratio ?? 0.65));
  const h = 120;
  const zones = rule.zones || ['center'];
  const z = zones[zoneIndex] || zones[0];
  const margin = LIRI_TEXT_DESIGN_ENGINE.ux_rules?.spacing?.minimum_to_canvas_edge ?? 48;
  const gap =
    LIRI_TEXT_DESIGN_ENGINE.ux_rules?.spacing?.minimum_between_text_blocks ?? 20;
  /** Sous une bande titre approximative (hero ~96px). */
  const belowTitleY = margin + 96 + gap;

  if (z === 'top-center') {
    return { x: Math.round((SB_KONVA_CANVAS_W - w) / 2), y: margin, width: w, height: h };
  }
  if (z === 'top-left') {
    return { x: margin, y: margin, width: w, height: h };
  }
  if (z === 'below-title') {
    return {
      x: Math.round((SB_KONVA_CANVAS_W - w) / 2),
      y: belowTitleY,
      width: w,
      height: h,
    };
  }
  if (z === 'top-left-secondary') {
    return { x: margin, y: margin + 72, width: w, height: h };
  }
  if (z === 'center-wide') {
    const wideW = Math.min(
      SB_KONVA_CANVAS_W - margin * 2,
      Math.round(SB_KONVA_CANVAS_W * Math.min(0.92, (rule.width_ratio ?? 0.68) * 1.12)),
    );
    return {
      x: Math.round((SB_KONVA_CANVAS_W - wideW) / 2),
      y: Math.round((SB_KONVA_CANVAS_H - h) / 2),
      width: wideW,
      height: Math.max(h, 100),
    };
  }
  if (z === 'center') {
    return {
      x: Math.round((SB_KONVA_CANVAS_W - w) / 2),
      y: Math.round((SB_KONVA_CANVAS_H - h) / 2),
      width: w,
      height: h,
    };
  }
  if (z === 'bottom-right') {
    return { x: SB_KONVA_CANVAS_W - w - margin, y: SB_KONVA_CANVAS_H - h - margin, width: w, height: h };
  }
  if (z === 'bottom-center') {
    return {
      x: Math.round((SB_KONVA_CANVAS_W - w) / 2),
      y: SB_KONVA_CANVAS_H - h - margin,
      width: w,
      height: h,
    };
  }
  return { x: margin, y: margin, width: w, height: h };
}

/**
 * @returns {string[]}
 */
export function getTextLibraryCategoryNames() {
  const c = LIRI_TEXT_LIBRARY.categories;
  if (!c || typeof c !== 'object') return [];
  return Object.keys(c).sort();
}

/**
 * @param {string} categoryName
 * @returns {string[]}
 */
export function getTextLibrarySnippets(categoryName) {
  const c = LIRI_TEXT_LIBRARY.categories;
  if (!c || typeof categoryName !== 'string') return [];
  const arr = c[categoryName];
  return Array.isArray(arr) ? arr : [];
}

/**
 * Un objet texte Konva pour une phrase type.
 * @param {string} snippet
 * @param {object} [options]
 * @param {string} [options.classification] — si défini, position via `placement_rules` du moteur LIRI
 * @param {Partial<import('../model/sceneTypes').SbKonvaObjectBase>} [options.overrides] — fusionné dans mkTextObject
 */
export function textSnippetToTextObject(snippet, options = {}) {
  const { classification, overrides = {} } =
    options && typeof options === 'object' && ('classification' in options || 'overrides' in options)
      ? options
      : { overrides: options };
  const text = String(snippet || '').trim() || '…';
  let x = 78;
  let y = 320;
  let w = Math.min(880, SB_KONVA_CANVAS_W - 96);
  let h = Math.max(72, Math.ceil(text.length / 42) * 30);
  if (classification) {
    const r = suggestPlacementRectForClassification(classification, 0);
    if (r) {
      x = r.x;
      y = r.y;
      w = r.width;
      h = Math.max(r.height, h);
    }
  }
  return mkTextObject({
    x,
    y,
    width: w,
    height: h,
    layer: 2,
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 22,
      fontWeight: 400,
      fontStyle: 'normal',
      fill: '#E2E8F0',
      align: 'left',
      lineHeight: 1.5,
    },
    content: { text, collapsible: false, defaultCollapsed: false, sectionLabel: '' },
    ...overrides,
  });
}

/**
 * @param {string} libraryCategory — ex. "Science"
 * @returns {string}
 */
export function getClassificationForTextLibraryCategory(libraryCategory) {
  return TEXT_LIBRARY_CATEGORY_TO_CLASSIFICATION[libraryCategory] || 'summary';
}
