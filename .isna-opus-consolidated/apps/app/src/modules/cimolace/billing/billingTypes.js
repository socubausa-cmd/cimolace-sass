/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BILLING TYPES
 * Types et enums pour la gestion des paiements et factures
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut du paiement
 */
export const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

/**
 * Type de paiement
 */
export const PaymentType = {
  SETUP: 'setup',
  SUBSCRIPTION: 'subscription',
  RENEWAL: 'renewal',
  SETUP_FEE: 'setup_fee',
};

/**
 * Statut de la facture
 */
export const InvoiceStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
};

/**
 * Type de facture
 */
export const InvoiceType = {
  SETUP: 'setup',
  MONTHLY: 'monthly',
  ADDON: 'addon',
};

/**
 * Mode de facturation
 */
export const BillingMode = {
  CHARIOW_MANUAL: 'chariow_manual',
  PAYPAL_AUTO: 'paypal_auto',
};
