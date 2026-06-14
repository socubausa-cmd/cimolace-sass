/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - STUDIO TYPES
 * Types pour le moteur de studio
 * ═══════════════════════════════════════════════════════════════
 */

export const StudioStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const StudioType = {
  COURSE: 'course',
  VIDEO: 'video',
  SMARTBOARD: 'smartboard',
  PRESENTATION: 'presentation',
};

export default {
  StudioStatus,
  StudioType,
};
