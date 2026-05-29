/**
 * Correspondance explicite chapitre post-prod ↔ index slide Copilot / scène Konva.
 * `chapterSlideMap[i]` = index de slide pour le chapitre `i`. Même longueur que la liste des chapitres.
 */

/**
 * Nombre d'indices utilisables à la fois par Copilot et Konva : min des deux quand les deux existent,
 * sinon l'unique source (évite des slides « sélectionnables » mais non activables sur le canvas).
 *
 * @param {number} copilotSlideCount
 * @param {number} sceneCount
 * @returns {number} ≥ 1
 */
export function bridgeableSlideIndexCount(copilotSlideCount, sceneCount) {
  const c = Math.max(0, Number(copilotSlideCount) || 0);
  const s = Math.max(0, Number(sceneCount) || 0);
  if (c > 0 && s > 0) return Math.max(1, Math.min(c, s));
  return Math.max(c, s, 1);
}

/**
 * Au moins deux chapitres pointent vers le même index de slide.
 *
 * @param {number[]|null|undefined} chapterSlideMap
 * @returns {boolean}
 */
export function hasDuplicateChapterSlideTargets(chapterSlideMap) {
  if (!Array.isArray(chapterSlideMap) || chapterSlideMap.length < 2) return false;
  const seen = new Set();
  for (const raw of chapterSlideMap) {
    const k = Math.floor(Number(raw));
    if (!Number.isFinite(k)) continue;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

/**
 * @param {number} chapterIdx
 * @param {number[]|null|undefined} chapterSlideMap
 * @param {number} numSlides nombre de slides / scènes disponibles (≥ 1)
 * @param {number} [numChapters]
 * @returns {number}
 */
export function resolveSlideIndexForChapter(chapterIdx, chapterSlideMap, numSlides, numChapters = 0) {
  const ns = Math.max(1, Number(numSlides) || 1);
  const cIdx = Math.max(0, Math.floor(Number(chapterIdx) || 0));
  if (Array.isArray(chapterSlideMap) && chapterSlideMap.length > cIdx) {
    const raw = Number(chapterSlideMap[cIdx]);
    if (Number.isFinite(raw)) {
      return Math.max(0, Math.min(Math.floor(raw), ns - 1));
    }
  }
  const cap = numChapters > 0 ? Math.min(cIdx, Math.max(0, numChapters - 1)) : cIdx;
  return Math.max(0, Math.min(cap, ns - 1));
}

/**
 * Trouve un chapitre dont le slide mappé correspond à `slideIdx`. En cas d'ambiguïté, le plus petit index.
 *
 * @param {number} slideIdx
 * @param {number[]|null|undefined} chapterSlideMap
 * @param {number} numChapters
 * @returns {number}
 */
export function resolveChapterIndexForSlide(slideIdx, chapterSlideMap, numChapters) {
  const s = Math.max(0, Math.floor(Number(slideIdx) || 0));
  const nc = Math.max(0, Number(numChapters) || 0);
  if (nc === 0) return 0;
  if (Array.isArray(chapterSlideMap) && chapterSlideMap.length) {
    for (let c = 0; c < Math.min(chapterSlideMap.length, nc); c += 1) {
      const m = Number(chapterSlideMap[c]);
      if (Number.isFinite(m) && Math.floor(m) === s) return c;
    }
  }
  return Math.max(0, Math.min(s, nc - 1));
}
