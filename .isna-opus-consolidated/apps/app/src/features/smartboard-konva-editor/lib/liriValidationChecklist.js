/**
 * Checklist validation finale (Module 7) — persistée dans le bundle workspace.
 */

export const DEFAULT_VALIDATION_CHECKLIST = {
  objectifsDefinis: false,
  structureCoherente: false,
  visuelsAdaptes: false,
  progressionLogique: false,
  scriptComplet: false,
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
