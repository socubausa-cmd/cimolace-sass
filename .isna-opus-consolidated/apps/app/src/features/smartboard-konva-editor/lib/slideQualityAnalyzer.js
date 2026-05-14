/**
 * slideQualityAnalyzer — évalue la qualité pédagogique et visuelle d'une scène.
 * Pure function, aucune dépendance externe.
 * Modules couverts : 2 (score), 12 (anti-surcharge), 16 (mémorisation), 17 (impact visuel).
 */

/** Seuils de densité textuelle */
const DENSITY_THRESHOLDS = {
  charPerSlide: { optimal: 280, max: 520 },
  wordsPerSlide: { optimal: 45, max: 80 },
  objectCount: { optimal: 6, max: 10 },
  textBlockCount: { optimal: 4, max: 7 },
};

/**
 * Calcule le score qualité d'une scène.
 * @param {import('../model/sceneTypes').SbKonvaScene} scene
 * @param {{ background?: string }} canvasConfig
 * @returns {SlideQualityResult}
 */
export function analyzeSlideQuality(scene, canvasConfig = {}) {
  const objects = scene?.objects || [];

  // --- Collecte des données brutes ---
  const textObjects = objects.filter((o) => o.type === 'text');
  const imageObjects = objects.filter((o) => o.type === 'image');
  const shapeObjects = objects.filter((o) => ['rect', 'circle', 'triangle', 'starshape', 'diamond', 'line'].includes(o.type));
  const iconObjects = objects.filter((o) => o.type === 'icon');
  const htmlObjects = objects.filter((o) => o.type === 'html');

  const allText = textObjects.map((o) => o.content?.text || '').join(' ');
  const charCount = allText.replace(/\s+/g, '').length;
  const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;
  const objectCount = objects.length;
  const hasBackground = canvasConfig.background && canvasConfig.background !== '#0b0f1a' && canvasConfig.background !== '#000000';
  const hasVisuals = imageObjects.length > 0 || iconObjects.length > 0 || htmlObjects.length > 0;
  const hasTitle = textObjects.some((o) => {
    const fs = o.style?.fontSize;
    return fs && Number(fs) >= 36;
  });

  // --- Scores individuels (0–100) ---

  // 1. Lisibilité — densité textuelle
  let readabilityScore = 100;
  if (charCount > DENSITY_THRESHOLDS.charPerSlide.max) {
    readabilityScore = Math.max(0, 100 - Math.round(((charCount - DENSITY_THRESHOLDS.charPerSlide.max) / DENSITY_THRESHOLDS.charPerSlide.max) * 80));
  } else if (charCount > DENSITY_THRESHOLDS.charPerSlide.optimal) {
    readabilityScore = Math.round(100 - ((charCount - DENSITY_THRESHOLDS.charPerSlide.optimal) / (DENSITY_THRESHOLDS.charPerSlide.max - DENSITY_THRESHOLDS.charPerSlide.optimal)) * 30);
  } else if (charCount === 0) {
    readabilityScore = 40; // slide vide
  }

  // 2. Clarté — structure (titre présent, pas trop de blocs texte)
  let clarityScore = 60;
  if (hasTitle) clarityScore += 20;
  if (textObjects.length >= 1 && textObjects.length <= DENSITY_THRESHOLDS.textBlockCount.optimal) clarityScore += 15;
  if (textObjects.length > DENSITY_THRESHOLDS.textBlockCount.max) clarityScore -= 20;
  if (objectCount === 0) clarityScore = 20;
  clarityScore = Math.max(0, Math.min(100, clarityScore));

  // 3. Impact visuel — présence d'images, formes, visuels
  let visualScore = 40;
  if (hasBackground) visualScore += 20;
  if (hasVisuals) visualScore += 30;
  if (shapeObjects.length > 0) visualScore += 10;
  if (iconObjects.length > 0) visualScore += 10;
  if (objectCount === 0) visualScore = 10;
  visualScore = Math.max(0, Math.min(100, visualScore));

  // 4. Densité (anti-surcharge) — moins = mieux
  let densityScore = 100;
  if (objectCount > DENSITY_THRESHOLDS.objectCount.max) {
    densityScore = Math.max(20, 100 - (objectCount - DENSITY_THRESHOLDS.objectCount.max) * 12);
  }
  if (wordCount > DENSITY_THRESHOLDS.wordsPerSlide.max) {
    densityScore = Math.max(20, densityScore - Math.round((wordCount - DENSITY_THRESHOLDS.wordsPerSlide.max) * 1.2));
  }

  // 5. Mémorisation — simplicité + structure
  let memorizationScore = 50;
  if (hasTitle) memorizationScore += 15;
  if (wordCount <= DENSITY_THRESHOLDS.wordsPerSlide.optimal) memorizationScore += 20;
  if (hasVisuals) memorizationScore += 15;
  if (wordCount > DENSITY_THRESHOLDS.wordsPerSlide.max) memorizationScore -= 20;
  memorizationScore = Math.max(0, Math.min(100, memorizationScore));

  // 6. Cohérence pédagogique — titre + corps + visuels en équilibre
  let pedagogyScore = 40;
  if (hasTitle && textObjects.length >= 2) pedagogyScore += 25;
  if (hasVisuals && textObjects.length >= 1) pedagogyScore += 25;
  if (objectCount >= 2 && objectCount <= 8) pedagogyScore += 10;
  pedagogyScore = Math.max(0, Math.min(100, pedagogyScore));

  // --- Score global pondéré ---
  const globalScore = Math.round(
    readabilityScore * 0.25 +
    clarityScore * 0.20 +
    visualScore * 0.15 +
    densityScore * 0.15 +
    memorizationScore * 0.15 +
    pedagogyScore * 0.10,
  );

  // --- Niveau ---
  let level = 'faible';
  let levelColor = '#ef4444';
  if (globalScore >= 80) { level = 'excellent'; levelColor = '#22c55e'; }
  else if (globalScore >= 65) { level = 'bon'; levelColor = '#84cc16'; }
  else if (globalScore >= 45) { level = 'moyen'; levelColor = '#f59e0b'; }

  // --- Suggestions ---
  const suggestions = [];
  if (charCount === 0 && objectCount === 0) suggestions.push({ type: 'empty', text: 'Slide vide — ajoutez du contenu.' });
  if (!hasTitle) suggestions.push({ type: 'title', text: 'Ajoutez un titre (grande police ≥ 36px).' });
  if (charCount > DENSITY_THRESHOLDS.charPerSlide.max) suggestions.push({ type: 'overload', text: `Trop de texte (${charCount} caractères) — réduisez ou découpez en 2 slides.` });
  if (wordCount > DENSITY_THRESHOLDS.wordsPerSlide.max) suggestions.push({ type: 'words', text: `${wordCount} mots — visez moins de ${DENSITY_THRESHOLDS.wordsPerSlide.optimal} mots par slide.` });
  if (!hasVisuals && !hasBackground) suggestions.push({ type: 'visual', text: 'Ajoutez une image, icône ou fond coloré pour l\'impact visuel.' });
  if (objectCount > DENSITY_THRESHOLDS.objectCount.max) suggestions.push({ type: 'clutter', text: `${objectCount} éléments — slide chargée, simplifiez.` });
  if (htmlObjects.length > 0 && objectCount > 6) suggestions.push({ type: 'html', text: 'HTML + beaucoup d\'objets = slide complexe. Isolez l\'animation.' });

  return {
    globalScore,
    level,
    levelColor,
    scores: {
      readability: readabilityScore,
      clarity: clarityScore,
      visual: visualScore,
      density: densityScore,
      memorization: memorizationScore,
      pedagogy: pedagogyScore,
    },
    stats: {
      charCount,
      wordCount,
      objectCount,
      textBlockCount: textObjects.length,
      hasTitle,
      hasVisuals,
      hasBackground,
    },
    suggestions,
    isOverloaded: objectCount > DENSITY_THRESHOLDS.objectCount.max || charCount > DENSITY_THRESHOLDS.charPerSlide.max,
  };
}

/**
 * Analyse un projet complet.
 * @param {import('../model/sceneTypes').SbKonvaProject} project
 * @returns {ProjectQualityResult}
 */
export function analyzeProjectQuality(project) {
  const scenes = project?.scenes || [];
  const canvasConfig = project?.canvas || {};
  const results = scenes.map((s) => analyzeSlideQuality(s, canvasConfig));

  const avgScore = results.length
    ? Math.round(results.reduce((acc, r) => acc + r.globalScore, 0) / results.length)
    : 0;

  const overloadedCount = results.filter((r) => r.isOverloaded).length;
  const emptyCount = results.filter((r) => r.stats.objectCount === 0).length;
  const excellentCount = results.filter((r) => r.level === 'excellent').length;
  const goodCount = results.filter((r) => r.level === 'bon').length;

  let projectLevel = 'faible';
  let projectColor = '#ef4444';
  if (avgScore >= 80) { projectLevel = 'excellent'; projectColor = '#22c55e'; }
  else if (avgScore >= 65) { projectLevel = 'bon'; projectColor = '#84cc16'; }
  else if (avgScore >= 45) { projectLevel = 'moyen'; projectColor = '#f59e0b'; }

  return {
    avgScore,
    projectLevel,
    projectColor,
    slideResults: results,
    stats: {
      totalSlides: scenes.length,
      overloadedCount,
      emptyCount,
      excellentCount,
      goodCount,
    },
  };
}

/**
 * @typedef {Object} SlideQualityResult
 * @property {number} globalScore
 * @property {'faible'|'moyen'|'bon'|'excellent'} level
 * @property {string} levelColor
 * @property {{ readability: number, clarity: number, visual: number, density: number, memorization: number, pedagogy: number }} scores
 * @property {{ charCount: number, wordCount: number, objectCount: number, textBlockCount: number, hasTitle: boolean, hasVisuals: boolean, hasBackground: boolean }} stats
 * @property {{ type: string, text: string }[]} suggestions
 * @property {boolean} isOverloaded
 */

/**
 * @typedef {Object} ProjectQualityResult
 * @property {number} avgScore
 * @property {string} projectLevel
 * @property {string} projectColor
 * @property {SlideQualityResult[]} slideResults
 * @property {{ totalSlides: number, overloadedCount: number, emptyCount: number, excellentCount: number, goodCount: number }} stats
 */
