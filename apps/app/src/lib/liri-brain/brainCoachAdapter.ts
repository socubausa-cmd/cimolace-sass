/**
 * Adapte la sortie LIRI Brain vers le format attendu par `LiveHostLongiaCoachPanel`
 * (legacy `longia-guest-live`).
 */

import type { LiriBrainAction, LiriStructuredOutput } from './types';

/** Mappe les types d'actions registre → clés `uiAction` du coach Edge. */
function mapActionTypeToUiAction(type: string): string {
  const m: Record<string, string> = {
    EXPLAIN_AGAIN: 'simplify',
    GIVE_EXAMPLE: 'give_example',
    ADD_TO_NOTES: 'add_to_notes',
    CREATE_SUMMARY: 'what_to_remember',
    CREATE_SLIDE: 'slide_generation',
    CREATE_MINDMAP: 'mindmap_generation',
    SEND_TO_SMARTBOARD: 'send_to_smartboard',
    CREATE_NEURON_RECALL: 'neuron_recall',
    SAVE_QUESTION: 'save_question',
    SUGGEST_EXERCISE: 'suggest_exercise',
    CREATE_QUIZ: 'create_quiz',
  };
  return m[type] || 'ask_question';
}

function mapActions(actions?: LiriBrainAction[] | null): Array<{ label: string; action: string }> {
  if (!actions?.length) return [];
  return actions.map((a) => ({
    label: String(a.label || ''),
    action: mapActionTypeToUiAction(String(a.type || '')),
  }));
}

export function adaptBrainToCoachGuestShape(structured: LiriStructuredOutput | null, fallbackAnswer: string) {
  const main = String(structured?.answer ?? fallbackAnswer ?? '').trim();
  const noteFirst =
    structured?.notes?.length && typeof structured.notes[0] === 'string'
      ? String(structured.notes[0]).trim()
      : '';

  const mapped = mapActions(structured?.actions);

  return {
    message: main,
    summary: noteFirst || undefined,
    explanation: undefined as string | undefined,
    example: undefined as string | undefined,
    actions: mapped,
  };
}
