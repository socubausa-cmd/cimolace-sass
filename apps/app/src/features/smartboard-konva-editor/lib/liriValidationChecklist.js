/**
 * Checklist validation finale (Module 7) — persistée dans le bundle workspace.
 */

/**
 * ⛔ Deux jeux de clés cohabitent VOLONTAIREMENT.
 *  - Les 5 premières (camelCase) sont l'ancien modèle, lu par SmartboardValidationChecklist.
 *    Elles restent déclarées pour que `mergeValidationChecklistFromExport` ne les supprime pas
 *    des payloads déjà enregistrés — on ne jette pas ce qu'on ne sait plus afficher.
 *  - Les suivantes sont les 19 cases RÉELLEMENT affichées par ValidationChecklist.jsx, qui les
 *    stockait dans une clé localStorage GLOBALE (`sb_validation_checklist`) : les cases cochées
 *    sur le cours A apparaissaient cochées sur le cours B, et rien ne partait jamais au cloud.
 *    Elles vivent désormais dans le store, donc dans le payload du workspace.
 */
export const DEFAULT_VALIDATION_CHECKLIST = {
  objectifsDefinis: false,
  structureCoherente: false,
  visuelsAdaptes: false,
  progressionLogique: false,
  scriptComplet: false,

  objectives: false,
  structure: false,
  progression: false,
  script: false,
  timing: false,
  audience: false,
  title_slide: false,
  visuals: false,
  colors: false,
  typo: false,
  density: false,
  examples: false,
  keywords: false,
  sources: false,
  summary: false,
  live_ready: false,
  exported: false,
  backup: false,
};

/** @typedef {keyof typeof DEFAULT_VALIDATION_CHECKLIST} ValidationChecklistKey */

export const VALIDATION_CHECKLIST_LABELS_FR = {
  objectifsDefinis: 'Objectifs pédagogiques définis',
  structureCoherente: 'Structure du cours cohérente',
  visuelsAdaptes: 'Visuels adaptés au public',
  progressionLogique: 'Progression logique',
  scriptComplet: 'Script / MasterScript suffisant',
};

/**
 * @param {unknown} raw
 */
export function mergeValidationChecklistFromExport(raw) {
  const base = { ...DEFAULT_VALIDATION_CHECKLIST };
  if (!raw || typeof raw !== 'object') return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  for (const k of Object.keys(DEFAULT_VALIDATION_CHECKLIST)) {
    if (typeof o[k] === 'boolean') {
      base[/** @type {keyof typeof base} */ (k)] = o[k];
    }
  }
  return base;
}

/**
 * @param {typeof DEFAULT_VALIDATION_CHECKLIST} c
 */
export function countValidationChecked(c) {
  return Object.values(c).filter(Boolean).length;
}
