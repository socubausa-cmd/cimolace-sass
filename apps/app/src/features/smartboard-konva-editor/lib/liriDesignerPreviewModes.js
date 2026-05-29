/**
 * Modes d'aperçu Designer (Module 3) — alignés store Copilot + UI Konva / Polotno.
 * @typedef {'editor' | 'teacher' | 'student' | 'live'} DesignerPreviewMode
 */

const MODES = /** @type {const} */ (['editor', 'teacher', 'student', 'live']);

/** Liste pour les boutons « Aperçu » (Polotno / studio). */
export const DESIGNER_PREVIEW_MODES = [...MODES];

/** @param {unknown} mode */
export function normalizeDesignerPreviewMode(mode) {
  const s = typeof mode === 'string' ? mode.trim() : '';
  return /** @type {DesignerPreviewMode} */ (MODES.includes(/** @type {any} */ (s)) ? s : 'editor');
}

/** @param {unknown} mode */
export function labelDesignerPreviewModeFr(mode) {
  const m = normalizeDesignerPreviewMode(mode);
  const labels = {
    editor: 'Édition',
    teacher: 'Professeur',
    student: 'Élève',
    live: 'Live',
  };
  return labels[m] || m;
}

/** Texte tooltip / accessibilité pour chaque mode d'aperçu. */
export function describeDesignerPreviewModeFr(mode) {
  const m = normalizeDesignerPreviewMode(mode);
  const d = {
    editor: 'Édition complète — tous les panneaux visibles.',
    teacher: 'Vue formateur — focus contenu et annotations.',
    student: 'Vue élève — lecture simplifiée.',
    live: 'Simulation projection — comme en salle.',
  };
  return d[m] || d.editor;
}
