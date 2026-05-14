/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SUBSCRIPTION TYPES
 * Types et enums pour la gestion des abonnements
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut de l'abonnement
 */
export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
};

/**
 * Cycle de facturation
 */
export const BillingCycle = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
};

/**
 * Provider de paiement
 */
export const PaymentProvider = {
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
  CHARIOW: 'chariow',
};
