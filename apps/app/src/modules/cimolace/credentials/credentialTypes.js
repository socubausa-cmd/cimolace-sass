/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CREDENTIAL TYPES
 * Types et enums pour la gestion des credentials
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Type de credential
 */
export const CredentialType = {
  API_KEY: 'api_key',
  WEBHOOK_SECRET: 'webhook_secret',
  DATABASE_URL: 'database_url',
  STORAGE_KEY: 'storage_key',
};

/**
 * Statut du credential
 */
export const CredentialStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};
