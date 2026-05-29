/**
 * Routeur rapide (heuristique, sans LLM) + sélection du modèle.
 */

import type { IntentClassification, LiriBrain, LiriBrainMode, LiriIntent } from './types';

/** Modèles OpenAI — rapide vs profond. */
export const MODEL_FAST = 'gpt-4o-mini';
export const MODEL_DEEP = 'gpt-4o';

export function selectModel(intent: LiriIntent): string {
  switch (intent) {
    case 'greeting':
    case 'simple_question':
    case 'private_coach':
    case 'explain':
    case 'summarize':
    case 'live_assistance':
    case 'smartboard_action':
      return MODEL_FAST;
    case 'deep_analysis':
    case 'course_structure':
    case 'slide_generation':
    case 'mindmap_generation':
      return MODEL_DEEP;
    case 'technical_help':
      return MODEL_FAST;
    default:
      return MODEL_FAST;
  }
}

export function resolveBrainFromIntent(intent: LiriIntent): LiriBrain {
  switch (intent) {
    case 'course_structure':
    case 'slide_generation':
    case 'mindmap_generation':
    case 'deep_analysis':
      return 'architect';
    case 'live_assistance':
    case 'smartboard_action':
      return 'live';
    default:
      return 'coach';
  }
}

/**
 * Classification heuristique O(1) — évite un modèle lourd pour salutations / questions courtes.
 */
export function classifyIntent(message: string): IntentClassification {
  const raw = message.trim();
  const lower = raw.toLowerCase();
  const short = raw.length < 48;

  // Salutations très courtes
  if (short && /^(bonjour|salut|coucou|hey|hello|hi|bonsoir)\b/i.test(raw)) {
    return {
      intent: 'greeting',
      brain: 'coach',
      model: MODEL_FAST,
      confidence: 0.92,
      routerNotes: 'heuristic_greeting',
    };
  }

  if (/mind[\s-]?map|carte\s+mentale|mindmap/i.test(raw)) {
    return {
      intent: 'mindmap_generation',
      brain: 'architect',
      model: MODEL_DEEP,
      confidence: 0.85,
      routerNotes: 'heuristic_mindmap',
    };
  }

  if (/slide|diapos|powerpoint|présentation\s+des\s+slides/i.test(raw)) {
    return {
      intent: 'slide_generation',
      brain: 'architect',
      model: MODEL_DEEP,
      confidence: 0.82,
      routerNotes: 'heuristic_slides',
    };
  }

  if (/plan\s+de\s+cours|structure\s+du\s+cours|sommaire\s+pédagogique/i.test(raw)) {
    return {
      intent: 'course_structure',
      brain: 'architect',
      model: MODEL_DEEP,
      confidence: 0.84,
      routerNotes: 'heuristic_course_structure',
    };
  }

  if (/résume|synthèse\s+complète|analyse\s+approfondie/i.test(lower)) {
    return {
      intent: raw.length > 120 ? 'deep_analysis' : 'summarize',
      brain: raw.length > 120 ? 'architect' : 'coach',
      model: raw.length > 120 ? MODEL_DEEP : MODEL_FAST,
      confidence: 0.72,
      routerNotes: 'heuristic_summary_vs_deep',
    };
  }

  if (/live|transcription|smartboard|tableau|moment\s+important|élève\s+a\s+demandé/i.test(lower)) {
    return {
      intent: 'live_assistance',
      brain: 'live',
      model: MODEL_FAST,
      confidence: 0.68,
      routerNotes: 'heuristic_live',
    };
  }

  if (/explique|reformule|autrement|plus\s+simple/i.test(lower)) {
    return {
      intent: 'explain',
      brain: 'coach',
      model: MODEL_FAST,
      confidence: 0.75,
      routerNotes: 'heuristic_explain',
    };
  }

  if (short && /^(pourquoi|comment|qu'est|quelles?|quelle|c\'est\s+quoi)\b/i.test(raw)) {
    return {
      intent: 'simple_question',
      brain: 'coach',
      model: MODEL_FAST,
      confidence: 0.7,
      routerNotes: 'heuristic_short_question',
    };
  }

  return {
    intent: 'simple_question',
    brain: 'coach',
    model: MODEL_FAST,
    confidence: 0.55,
    routerNotes: 'heuristic_default_coach',
  };
}

export function chooseBrainAndIntent(
  message: string,
  mode: LiriBrainMode | undefined,
  classification: IntentClassification,
): IntentClassification {
  if (mode && mode !== 'auto') {
    return {
      ...classification,
      brain: mode,
      model: selectModelForBrain(mode, classification.intent),
      routerNotes: `${classification.routerNotes ?? ''};forced_mode=${mode}`,
    };
  }
  return classification;
}

function selectModelForBrain(brain: LiriBrain, intent: LiriIntent): string {
  if (brain === 'architect') return MODEL_DEEP;
  if (brain === 'live') return MODEL_FAST;
  return selectModel(intent);
}
