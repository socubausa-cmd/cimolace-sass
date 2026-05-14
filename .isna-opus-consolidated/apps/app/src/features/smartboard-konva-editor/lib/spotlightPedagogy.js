/**
 * Spotlight pédagogique — opacité selon la section active (J2).
 * Les connecteurs (ligne, flèche) restent un peu plus visibles quand ils sont hors focus.
 */

/** @param {string | undefined} type */
function isConnectorType(type) {
  return type === 'line' || type === 'arrow';
}

/**
 * @typedef {object} SpotlightContext
 * @property {string | null} activeSectionId — `null` = pas de spotlight
 * @property {{ id: string; label?: string }[] | undefined} sections — ordre = progression a, b, c…
 */

/**
 * @param {import('../model/sceneTypes').SbKonvaObjectBase & { type?: string }} obj
 * @param {SpotlightContext} ctx
 * @returns {number} opacité effective 0–1
 */
export function computeSpotlightOpacity(obj, ctx) {
  const activeSectionId = ctx.activeSectionId;
  const sections = ctx.sections || [];

  const base = typeof obj.opacity === 'number' && Number.isFinite(obj.opacity) ? obj.opacity : 1;

  if (!activeSectionId) return base;

  const conn = isConnectorType(obj.type);

  /** Objet sans section : arrière-plan du slide */
  const capNoSection = conn ? 0.72 : 0.66;
  if (!obj.sectionId) return Math.min(base, capNoSection);

  if (obj.sectionId === activeSectionId) return base;

  const sectionOrder = sections.findIndex((s) => s.id === obj.sectionId);
  const activeOrder = sections.findIndex((s) => s.id === activeSectionId);
  if (activeOrder < 0 || sectionOrder < 0) return Math.min(base, conn ? 0.5 : 0.4);

  if (sectionOrder < activeOrder) {
    const cap = conn ? 0.46 : 0.3;
    return Math.min(base, cap);
  }
  const capFuture = conn ? 0.12 : 0.08;
  return Math.min(base, capFuture);
}
