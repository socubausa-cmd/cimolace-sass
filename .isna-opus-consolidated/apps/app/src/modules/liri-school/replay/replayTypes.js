/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - REPLAY TYPES
 * Types pour le moteur de replay
 * ═══════════════════════════════════════════════════════════════
 */

export const ReplayStatus = {
  PROCESSING: 'processing',
  AVAILABLE: 'available',
  EXPIRED: 'expired',
  DELETED: 'deleted',
};

export const ReplayQuality = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra',
};

export default {
  ReplayStatus,
  ReplayQuality,
};
