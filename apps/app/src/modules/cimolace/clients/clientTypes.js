/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CLIENT TYPES
 * Types et enums pour la gestion des clients
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut du client
 */
export const ClientStatus = {
  PROSPECT: 'prospect',
  ACTIVE: 'active',
  CONFIGURING: 'configuring',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
};

/**
 * Type de client
 */
export const ClientType = {
  SCHOOL: 'school',
  ECOMMERCE: 'ecommerce',
  COACH: 'coach',
  AGENCY: 'agency',
  COMMUNITY: 'community',
  OTHER: 'other',
};
