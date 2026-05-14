/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SITE TYPES
 * Types et enums pour la gestion des sites
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Statut du site
 */
export const SiteStatus = {
  PENDING: 'pending',
  DEPLOYING: 'deploying',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
};

/**
 * Type de site
 */
export const SiteType = {
  SCHOOL: 'school',
  ECOMMERCE: 'ecommerce',
  LANDING: 'landing',
  LIVE: 'live',
  STUDIO: 'studio',
  COMMUNITY: 'community',
  HYBRID: 'hybrid',
};

/**
 * Plan du site
 */
export const SitePlan = {
  STARTER: 'starter',
  PRO: 'pro',
  ELITE: 'elite',
};

/**
 * Environnement du site
 */
export const SiteEnvironment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
};
