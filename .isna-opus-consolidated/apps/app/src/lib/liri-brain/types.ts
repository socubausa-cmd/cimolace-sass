/**
 * Types centraux — LIRI Brain (Coach · Architecte · Live IA).
 */

export type LiriBrain = 'coach' | 'architect' | 'live';

/** Intentions routées avant tout appel LLM lourd. */
export type LiriIntent =
  | 'greeting'
  | 'simple_question'
  | 'explain'
  | 'summarize'
  | 'course_structure'
  | 'slide_generation'
  | 'mindmap_generation'
  | 'live_assistance'
  | 'smartboard_action'
  | 'private_coach'
  | 'deep_analysis'
  | 'technical_help';

/** Mode client : auto = routeur décide. */
export type LiriBrainMode = 'auto' | LiriBrain;

/** Réponse JSON interne unifiée (post-traitement / métadonnées). */
export interface LiriStructuredOutput {
  brain: LiriBrain;
  intent: LiriIntent;
  answer: string;
  actions: LiriBrainAction[];
  notes: string[];
  suggestions: string[];
  confidence: number;
}

export interface LiriBrainAction {
  type: LiriBrainActionType;
  label: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export type LiriBrainActionType =
  | 'ADD_TO_NOTES'
  | 'CREATE_MINDMAP'
  | 'CREATE_SLIDE'
  | 'CREATE_SUMMARY'
  | 'CREATE_QUIZ'
  | 'SEND_TO_SMARTBOARD'
  | 'CREATE_NEURON_RECALL'
  | 'SAVE_QUESTION'
  | 'SUGGEST_EXERCISE'
  | 'EXPLAIN_AGAIN'
  | 'GIVE_EXAMPLE';

/** Mémoire courte par session (côté client ou serveur). */
export interface SessionMemory {
  sessionId: string;
  userId: string | null;
  liveId: string | null;
  lastMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentTopic: string | null;
  currentSlide: number | null;
  keyPoints: string[];
  questions: string[];
  summaries: string[];
  actions: string[];
}

export interface BrainRequestContext {
  transcriptSnippet?: string | null;
  transcriptPartial?: string | null;
  chatExcerpt?: string | null;
  stepTitle?: string | null;
  sessionTitle?: string | null;
  smartBoardSnapshot?: string | null;
  /** Données libres (NeuronQ, métriques, etc.). */
  extra?: Record<string, unknown>;
}

export interface BrainRouteInput {
  message: string;
  sessionId: string;
  liveId?: string | null;
  userId?: string | null;
  mode?: LiriBrainMode;
  context?: BrainRequestContext;
  /** Mémoire hydratée côté client ; sera trimée côté serveur. */
  memory?: Partial<SessionMemory> | null;
  /** Force streaming (défaut true). */
  stream?: boolean;
}

export interface IntentClassification {
  intent: LiriIntent;
  brain: LiriBrain;
  /** Modèle OpenAI recommandé pour cet intent. */
  model: string;
  confidence: number;
  /** Pour debug / analytics. */
  routerNotes?: string;
}

/** Cadence suggestion résumé live (minutes). */
export const LIVE_SUMMARY_INTERVAL_MIN = { min: 2, max: 5 } as const;
