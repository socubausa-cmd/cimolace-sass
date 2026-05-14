import { SYSTEM_LIRI_MASTERCLASS_COACH } from '@/lib/liri-brain/prompts';

export function buildMasterclassSystemPrompt(): string {
  return [
    SYSTEM_LIRI_MASTERCLASS_COACH,
    '',
    'Règles strictes:',
    '- Toujours analyser avant générer.',
    '- Toujours structurer.',
    '- Toujours répondre en JSON valide.',
    '- Respecter toutes les sections pédagogiques obligatoires.',
  ].join('\n');
}

export function buildMasterclassUserPrompt(rawText: string): string {
  return [
    'Transforme le texte brut ci-dessous en masterclass complète.',
    'Retourne un JSON strict avec: analysis_output, blocks, chapters, pedagogy, slides, script, exports.',
    '',
    'Texte source:',
    rawText,
  ].join('\n');
}
