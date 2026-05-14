import type { MasterclassQualityReport } from './types';

export function validateMasterclassPayload(payload: any): MasterclassQualityReport {
  const errors: string[] = [];

  if (!payload?.analysis_output) errors.push('analysis manquante');
  if (!Array.isArray(payload?.blocks) || payload.blocks.length === 0) errors.push('blocks manquants');
  if (!Array.isArray(payload?.chapters) || payload.chapters.length === 0) errors.push('chapitres manquants');

  const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
  chapters.forEach((chapter: any, index: number) => {
    const label = `chapitre ${index + 1}`;
    if (!chapter?.objective) errors.push(`${label}: objectif manquant`);
    if (!chapter?.skill_to_acquire) errors.push(`${label}: compétence manquante`);
    if (!chapter?.knowledge_to_transmit) errors.push(`${label}: connaissance manquante`);
    if (!chapter?.real_life_situation) errors.push(`${label}: mise en situation manquante`);
    if (!chapter?.pedagogical_tension) errors.push(`${label}: tension manquante`);
    if (!chapter?.thought_experiment) errors.push(`${label}: expérience de pensée manquante`);
    if (!chapter?.revelation_moment && !chapter?.main_revelation) errors.push(`${label}: révélation manquante`);
    if (!Array.isArray(chapter?.analogies) || chapter.analogies.length < 2) errors.push(`${label}: analogies insuffisantes`);
    if (!Array.isArray(chapter?.examples) || chapter.examples.length < 3) errors.push(`${label}: exemples insuffisants`);
    if (!chapter?.workshop?.instructions) errors.push(`${label}: atelier manquant`);
    if (!Array.isArray(chapter?.je_retiens) || chapter.je_retiens.length === 0) errors.push(`${label}: JE RETIENS manquant`);
    if (!Array.isArray(chapter?.understanding_test) || chapter.understanding_test.length === 0) errors.push(`${label}: test manquant`);
    if (!chapter?.real_application) errors.push(`${label}: cas réel manquant`);
    if (!chapter?.transition_to_next) errors.push(`${label}: transition manquante`);
  });

  return { valid: errors.length === 0, errors };
}
