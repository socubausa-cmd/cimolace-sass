/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - NEURO RECALL TYPES
 * Types pour le moteur de neuro recall
 * ═══════════════════════════════════════════════════════════════
 */

export const NeuroRecallStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

export const NeuroRecallType = {
  FLASHCARDS: 'flashcards',
  QUIZ: 'quiz',
  SPACED_REPETITION: 'spaced_repetition',
  MINDMAP: 'mindmap',
};

export default {
  NeuroRecallStatus,
  NeuroRecallType,
};
