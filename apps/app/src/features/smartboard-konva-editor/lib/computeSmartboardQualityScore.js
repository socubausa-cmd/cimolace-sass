/**
 * Score qualité slide (Module 2) — heuristiques locales sur le JSON Polotno + plan Copilot.
 * Pas d'appel IA : indicateurs 0–100 puis niveau global.
 */

/**
 * @typedef {Object} SmartboardQualityResult
 * @property {number} score
 * @property {'faible'|'moyen'|'bon'|'excellent'} band
 * @property {string} labelFr
 * @property {{
 *   lisibilite: number;
 *   clarte: number;
 *   densite: number;
 *   impactVisuel: number;
 *   memorisation: number;
 *   coherencePedagogique: number;
 * }} indicators
 * @property {string[]} hints
 * @property {number} elementCount
 * @property {number} textChars
 */

/**
 * @typedef {Object} CanvasWalkAcc
 * @property {number} elementCount
 * @property {number} textChars
 * @property {number} images
 * @property {number} lineLike
 * @property {Record<string, number>} typeCounts
 */

import { SMARTBOARD_DESIGN_HEIGHT, SMARTBOARD_DESIGN_WIDTH } from '@/lib/smartboardDesignCanvas';

const AREA = SMARTBOARD_DESIGN_WIDTH * SMARTBOARD_DESIGN_HEIGHT;

/**
 * @param {unknown} nodes
 * @param {CanvasWalkAcc} acc
 */
function walkPolotnoNodes(nodes, acc) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    acc.elementCount += 1;
    const t = /** @type {{ type?: string }} */ (node).type || 'unknown';
    acc.typeCounts[t] = (acc.typeCounts[t] || 0) + 1;
    if (t === 'text') {
      const text = /** @type {{ text?: string }} */ (node).text;
      if (text) acc.textChars += String(text).length;
    }
    if (t === 'image') acc.images += 1;
    if (t === 'line' || t === 'figure') acc.lineLike += 1;
    const ch = /** @type {{ children?: unknown[] }} */ (node).children;
    if (Array.isArray(ch) && ch.length) walkPolotnoNodes(ch, acc);
  }
}

/**
 * @param {unknown} polotnoProject
 * @returns {CanvasWalkAcc}
 */
export function extractCanvasWalkAccum(polotnoProject) {
  const pages =
    polotnoProject && typeof polotnoProject === 'object' && Array.isArray(/** @type {{ pages?: unknown[] }} */ (polotnoProject).pages)
      ? /** @type {{ pages: unknown[] }} */ (polotnoProject).pages
      : [];
  const firstPage = pages[0] && typeof pages[0] === 'object' ? /** @type {{ children?: unknown[] }} */ (pages[0]) : null;
  const children = Array.isArray(firstPage?.children) ? firstPage.children : [];

  const acc = {
    elementCount: 0,
    textChars: 0,
    images: 0,
    lineLike: 0,
    typeCounts: /** @type {Record<string, number>} */ ({}),
  };
  walkPolotnoNodes(children, acc);
  return acc;
}

/** @param {number} x */
function clamp01(x) {
  return Math.max(0, Math.min(100, x));
}

/**
 * @param {number} avg
 * @returns {'faible'|'moyen'|'bon'|'excellent'}
 */
function bandFromAverage(avg) {
  if (avg < 38) return 'faible';
  if (avg < 52) return 'moyen';
  if (avg < 68) return 'bon';
  return 'excellent';
}

/**
 * @param {string} band
 */
export function labelQualityBandFr(band) {
  switch (band) {
    case 'faible':
      return 'Faible';
    case 'moyen':
      return 'Moyen';
    case 'bon':
      return 'Bon';
    case 'excellent':
      return 'Excellent';
    default:
      return band;
  }
}

/**
 * @param {CanvasWalkAcc} acc
 */
function canvasIndicatorsFromWalk(acc) {
  const distinctTypes = Object.keys(acc.typeCounts).length;
  const textPressure = acc.textChars / (AREA / 9000);
  const lisibilite = clamp01(92 - Math.min(85, textPressure * 18));

  const clutter = acc.elementCount / (AREA / 120000);
  const clarte = clamp01(55 + distinctTypes * 8 - Math.min(40, Math.max(0, clutter - 12) * 2.2));

  const densite = clamp01(88 - Math.min(80, Math.max(0, clutter - 8) * 3));

  const visualBoost = acc.images * 14 + acc.lineLike * 4 + Math.min(distinctTypes, 6) * 3;
  const impactVisuel = clamp01(28 + visualBoost);

  return {
    lisibilite: Math.round(lisibilite),
    clarte: Math.round(clarte),
    densite: Math.round(densite),
    impactVisuel: Math.round(impactVisuel),
  };
}

/**
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null | undefined} course
 * @param {number} slideIndex
 */
function pedagogicalIndicatorsForSlide(course, slideIndex) {
  const slide = course?.slides?.[slideIndex];
  const script =
    slide && typeof slide.masterScript?.discourse === 'string' ? slide.masterScript.discourse : '';
  const keyPts = slide?.masterScript?.keyPoints;
  const kpLen = Array.isArray(keyPts) ? keyPts.filter(Boolean).length : 0;
  let memorisation = 35;
  if (script.length > 120) memorisation += 28;
  else if (script.length > 40) memorisation += 18;
  memorisation += Math.min(25, kpLen * 6);
  memorisation = Math.round(clamp01(memorisation));

  let coherencePedagogique = 38;
  if (course?.slides?.length) coherencePedagogique += 22;
  if (slide?.objective && String(slide.objective).length > 10) coherencePedagogique += 18;
  if (slide?.content?.mainText && String(slide.content.mainText).length > 20) coherencePedagogique += 12;
  coherencePedagogique = Math.round(clamp01(coherencePedagogique));

  return { memorisation, coherencePedagogique };
}

/**
 * @param {{
 *   lisibilite: number;
 *   clarte: number;
 *   densite: number;
 *   impactVisuel: number;
 *   memorisation: number;
 *   coherencePedagogique: number;
 * }} indicators
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null | undefined} course
 * @param {CanvasWalkAcc} acc
 */
function buildHints(indicators, course, acc) {
  const hints = [];
  if (indicators.lisibilite < 50) hints.push('Réduire le volume de texte sur le canvas pour gagner en lisibilité.');
  if (indicators.densite < 45) hints.push('Alléger la densité d\'objets (espacement, hiérarchie).');
  if (indicators.impactVisuel < 45) hints.push('Ajouter des visuels (images, formes) pour renforcer l\'impact.');
  if (indicators.memorisation < 45 && course) hints.push('Enrichir le MasterScript / points clés du slide actif.');
  if (indicators.coherencePedagogique < 50 && !course) hints.push('Lancer l\'analyse du document pour cadrer le plan Copilot.');
  return hints.slice(0, 4);
}

/**
 * @param {CanvasWalkAcc} acc
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null | undefined} course
 * @param {number} slideIndex
 * @returns {SmartboardQualityResult}
 */
function assembleQualityResult(acc, course, slideIndex) {
  const ci = canvasIndicatorsFromWalk(acc);
  const pi = pedagogicalIndicatorsForSlide(course, slideIndex);
  const indicators = {
    lisibilite: ci.lisibilite,
    clarte: ci.clarte,
    densite: ci.densite,
    impactVisuel: ci.impactVisuel,
    memorisation: pi.memorisation,
    coherencePedagogique: pi.coherencePedagogique,
  };

  const avg =
    (indicators.lisibilite +
      indicators.clarte +
      indicators.densite +
      indicators.impactVisuel +
      indicators.memorisation +
      indicators.coherencePedagogique) /
    6;

  const band = bandFromAverage(avg);

  return {
    score: Math.round(avg),
    band,
    labelFr: labelQualityBandFr(band),
    indicators,
    hints: buildHints(indicators, course, acc),
    elementCount: acc.elementCount,
    textChars: acc.textChars,
  };
}

/**
 * @param {unknown} polotnoProject — store.toJSON()
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} [course]
 * @param {number} [activeSlideIndex]
 * @returns {SmartboardQualityResult}
 */
export function computeSmartboardQualityScore(polotnoProject, course, activeSlideIndex = 0) {
  const acc = extractCanvasWalkAccum(polotnoProject);
  return assembleQualityResult(acc, course, activeSlideIndex);
}

/**
 * Un seul parcours canvas, un score par fiche du plan (mémorisation / cohérence liées au script de chaque slide).
 * @param {unknown} polotnoProject
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} course
 * @returns {SmartboardQualityResult[]}
 */
export function computeQualityScoresForAllPlanSlides(polotnoProject, course) {
  if (!course?.slides?.length) return [];
  const acc = extractCanvasWalkAccum(polotnoProject);
  return course.slides.map((_, i) => assembleQualityResult(acc, course, i));
}

/**
 * Parcours une scène Konva (sceneModel) pour alimenter les mêmes heuristiques que Polotno (Module 2 · parité moteur Konva).
 * @param {unknown} scene — `getActiveScene()` / objet avec `objects[]`
 * @returns {CanvasWalkAcc}
 */
export function extractCanvasWalkAccumFromKonvaScene(scene) {
  const objects = scene && typeof scene === 'object' && Array.isArray(/** @type {{ objects?: unknown[] }} */ (scene).objects)
    ? /** @type {{ objects: unknown[] }} */ (scene).objects
    : [];
  const acc = {
    elementCount: 0,
    textChars: 0,
    images: 0,
    lineLike: 0,
    typeCounts: /** @type {Record<string, number>} */ ({}),
  };
  for (const raw of objects) {
    if (!raw || typeof raw !== 'object') continue;
    const o = /** @type {{ type?: string; visible?: boolean; content?: Record<string, unknown> }} */ (raw);
    if (o.visible === false) continue;
    acc.elementCount += 1;
    const t = o.type || 'unknown';
    acc.typeCounts[t] = (acc.typeCounts[t] || 0) + 1;
    if (t === 'text') {
      acc.textChars += String(o.content?.text ?? '').length;
    } else if (t === 'image') {
      acc.images += 1;
    } else if (t === 'rect' || t === 'circle') {
      acc.lineLike += 1;
    } else if (t === 'line' || t === 'arrow') {
      acc.lineLike += 1;
    } else if (t === 'html') {
      acc.textChars += Math.min(800, String(o.content?.html ?? '').length);
    } else if (t === 'icon') {
      acc.lineLike += 1;
    }
  }
  return acc;
}

/**
 * @param {unknown} konvaScene
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} [course]
 * @param {number} [activeSlideIndex]
 */
export function computeSmartboardQualityScoreFromKonvaScene(konvaScene, course, activeSlideIndex = 0) {
  const acc = extractCanvasWalkAccumFromKonvaScene(konvaScene);
  return assembleQualityResult(acc, course, activeSlideIndex);
}

/**
 * @param {unknown} konvaScene
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} course
 */
export function computeQualityScoresForAllPlanSlidesFromKonvaScene(konvaScene, course) {
  if (!course?.slides?.length) return [];
  const acc = extractCanvasWalkAccumFromKonvaScene(konvaScene);
  return course.slides.map((_, i) => assembleQualityResult(acc, course, i));
}
