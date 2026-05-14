/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - LESSON TYPES
 * Types pour le moteur de leçons
 * ═══════════════════════════════════════════════════════════════
 */

export const LessonStatus = {
  LOCKED: 'locked',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const LessonType = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  EXERCISE: 'exercise',
  LIVE: 'live',
};

export const ContentType = {
  VIDEO: 'video',
  POWERPOINT: 'powerpoint',
  QUIZ: 'quiz',
  DOCUMENT: 'document',
};

export default {
  LessonStatus,
  LessonType,
  ContentType,
};
