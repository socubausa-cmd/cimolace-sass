/**
 * Registre d'actions SmartBoard / pédagogiques — LIRI Brain.
 */

import type { LiriBrainAction, LiriBrainActionType } from './types';

function entry(
  type: LiriBrainActionType,
  label: string,
  payload: Record<string, unknown> = {},
  requiresConfirmation = false,
): LiriBrainAction {
  return { type, label, payload, requiresConfirmation };
}

/** Actions disponibles (référence unique pour UI & orchestrateur). */
export const LIRI_BRAIN_ACTION_REGISTRY: LiriBrainAction[] = [
  entry('ADD_TO_NOTES', 'Ajouter aux notes', {}, false),
  entry('CREATE_MINDMAP', 'Créer une mindmap', {}, true),
  entry('CREATE_SLIDE', 'Créer une slide', {}, true),
  entry('CREATE_SUMMARY', 'Créer un résumé', {}, false),
  entry('CREATE_QUIZ', 'Créer un quiz', {}, true),
  entry('SEND_TO_SMARTBOARD', 'Envoyer vers le tableau', {}, false),
  entry('CREATE_NEURON_RECALL', 'Créer un NeuronRecall', {}, true),
  entry('SAVE_QUESTION', 'Enregistrer la question', {}, false),
  entry('SUGGEST_EXERCISE', 'Suggérer un exercice', {}, true),
  entry('EXPLAIN_AGAIN', 'Réexpliquer autrement', {}, false),
  entry('GIVE_EXAMPLE', 'Donner un exemple', {}, false),
];

export function findActionsByTypes(types: LiriBrainActionType[]): LiriBrainAction[] {
  const set = new Set(types);
  return LIRI_BRAIN_ACTION_REGISTRY.filter((a) => set.has(a.type));
}
