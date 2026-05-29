/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CONTRACT TYPES
 * Types et enums pour la gestion des contrats
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Type de contrat
 */
export const ContractType = {
  SETUP: 'setup',
  SUBSCRIPTION: 'subscription',
  MAINTENANCE: 'maintenance',
  ADDON: 'addon',
  CUSTOM: 'custom',
};

/**
 * Statut du contrat
 */
export const ContractStatus = {
  DRAFT: 'draft',
  SIGNED: 'signed',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};
