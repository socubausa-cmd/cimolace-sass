/** Référentiels UI — alignés sur le pack pédagogie du futur (types de blocs). */

export const PEDAGOGY_TYPE_OPTIONS = [
  { value: 'generic', label: 'Jour générique' },
  { value: 'opening_live', label: 'Live d’ouverture' },
  { value: 'smartboard_session', label: 'Session SmartBoard' },
  { value: 'friction_block', label: 'Friction / défi' },
  { value: 'recall_block', label: 'Recall / mémorisation' },
  { value: 'closure_live', label: 'Live de clôture' },
  { value: 'experiment_block', label: 'Expérimentation' },
  { value: 'previsualisation_video', label: 'Prévisualisation vidéo' },
];

export const BLOCK_TYPE_OPTIONS = [
  { value: 'previsualisation_video', label: 'Prévisualisation vidéo' },
  { value: 'opening_live', label: 'Live d’ouverture' },
  { value: 'smartboard_session', label: 'Session SmartBoard' },
  { value: 'friction_block', label: 'Friction pédagogique' },
  { value: 'doctrinal_video', label: 'Vidéo doctrinale' },
  { value: 'experiment_block', label: 'Expérimentation' },
  { value: 'closure_live', label: 'Live de clôture' },
  { value: 'recall_block', label: 'Recall / mémorisation' },
  { value: 'quiz_block', label: 'Quiz' },
  { value: 'mindmap_block', label: 'Mindmap' },
  { value: 'summary_block', label: 'Synthèse' },
];

export function nextSortOrder(rows) {
  if (!rows?.length) return 0;
  return Math.max(...rows.map((r) => Number(r.sort_order) || 0)) + 1;
}

export function nextDayNumber(days) {
  if (!days?.length) return 1;
  return Math.max(...days.map((d) => Number(d.day_number) || 0)) + 1;
}

/** Grille semaine : day_number 1 = lundi … 7 = dimanche */
export const WEEKDAY_GRID_LABELS = [
  { n: 1, short: 'Lun' },
  { n: 2, short: 'Mar' },
  { n: 3, short: 'Mer' },
  { n: 4, short: 'Jeu' },
  { n: 5, short: 'Ven' },
  { n: 6, short: 'Sam' },
  { n: 7, short: 'Dim' },
];
