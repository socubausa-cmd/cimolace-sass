/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TICKET TYPES
 * Types et enums pour la gestion des tickets support
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut du ticket
 */
export const TicketStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

/**
 * Priorité du ticket
 */
export const TicketPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

/**
 * Catégorie du ticket
 */
export const TicketCategory = {
  TECHNICAL: 'technical',
  BILLING: 'billing',
  FEATURE_REQUEST: 'feature_request',
  BUG: 'bug',
  GENERAL: 'general',
  DOMAIN: 'domain',
  PAYMENT: 'payment',
  API: 'api',
};
