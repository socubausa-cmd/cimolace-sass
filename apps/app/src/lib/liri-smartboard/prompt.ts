import { SMARTBOARD_STEPS } from '@/lib/liri-smartboard/steps';
import type { GenerateSlideInput } from '@/lib/liri-smartboard/types';

function matrixFor(stepKey: string) {
  return SMARTBOARD_STEPS.find((s) => s.key === stepKey)?.visualWeights || SMARTBOARD_STEPS[0].visualWeights;
}

export function buildSmartboardSystemPrompt(): string {
  return [
    'Tu es LIRI SMARTBOARD ENGINE, architecte pédagogique expert.',
    'Tu conserves toutes tes capacités existantes de SmartBoard Architect et tu ajoutes les règles suivantes.',
    'Règle absolue: 1 étape pédagogique = 1 slide. Ne jamais générer un chapitre complet.',
    'Tu dois produire du JSON strict uniquement, sans markdown.',
    'Chaque slide doit enseigner, guider, structurer la pensée et engager l\'élève.',
    'Le texte doit rester concis, actionnable, orienté transmission.',
  ].join('\n');
}

export function buildSmartboardUserPrompt(input: GenerateSlideInput): string {
  const weights = matrixFor(input.step);
  return [
    `Source global: ${input.sourceText}`,
    `Chapitre: ${input.chapter.chapter_id} - ${input.chapter.title}`,
    `Objectif: ${input.chapter.objective || ''}`,
    `Compétence: ${input.chapter.skill || ''}`,
    `Connaissance: ${input.chapter.knowledge || ''}`,
    `Étape à générer: ${input.step}`,
    `Slides précédents (résumé): ${input.previousSlides.map((s) => `${s.step}:${s.title}`).slice(-5).join(' | ') || 'aucun'}`,
    `Matrice visuelle recommandée: texte ${weights.texte}% ; image ${weights.image}% ; graphique ${weights.graphique}% ; infographie ${weights.infographie}% ; interaction ${weights.interaction}%`,
    'Schéma JSON attendu:',
    JSON.stringify(
      {
        slide_id: `${input.chapter.chapter_id}_${input.step}`,
        chapter_id: input.chapter.chapter_id,
        step: input.step,
        title: 'Titre court',
        pedagogical_goal: 'But pédagogique',
        dominant_mode: 'texte',
        content: { main_text: 'Message central', support_text: 'Support éventuel' },
        visual: { type: 'image_symbolique', prompt: 'Prompt visuel' },
        graphic: { type: 'optional' },
        student_action: 'Action élève',
        teacher_note: 'Consigne professeur',
        transition: 'Lien vers slide suivante',
      },
      null,
      2,
    ),
  ].join('\n\n');
}

