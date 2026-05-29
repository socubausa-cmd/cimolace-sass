/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE INCIDENT TYPES
 * Types et enums pour la gestion des incidents techniques
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut de l'incident
 */
export const IncidentStatus = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  IDENTIFIED: 'identified',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
};

/**
 * Gravité de l'incident
 */
export const IncidentSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};
