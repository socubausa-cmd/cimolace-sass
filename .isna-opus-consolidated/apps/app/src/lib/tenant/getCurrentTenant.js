/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CURRENT TENANT - HELPER POUR RÉCUPÉRER LE TENANT ACTUEL
 * ═══════════════════════════════════════════════════════════════
 */

import { getTenantService } from './tenantService.js';

/**
 * Récupère le tenant actuel à partir du slug dans l'URL
 * Utilisation dans les composants React avec useTenant hook
 */
export async function getCurrentTenant(slug) {
  if (!slug) {
    console.error('Tenant slug is required');
    return null;
  }

  const tenantService = getTenantService();
  const tenant = await tenantService.getTenantBySlug(slug);

  return tenant;
}

/**
 * Récupère la config du tenant actuel
 */
export async function getTenantConfig(slug) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    branding: tenant.branding,
    features: tenant.features,
    limits: tenant.limits,
    content: tenant.content,
  };
}

/**
 * Vérifie si le tenant a une feature activée
 */
export async function hasFeature(slug, feature) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return false;
  }

  return tenant.features[feature] || false;
}

/**
 * Vérifie si le tenant est actif
 */
export async function isTenantActive(slug) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return false;
  }

  return tenant.status === 'active';
}

/**
 * Récupère le branding du tenant
 */
export async function getTenantBranding(slug) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return null;
  }

  return tenant.branding;
}

/**
 * Récupère les limits du tenant
 */
export async function getTenantLimits(slug) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return null;
  }

  return tenant.limits;
}

/**
 * Récupère le contenu du tenant (messages, labels, descriptions)
 */
export async function getTenantContent(slug) {
  const tenant = await getCurrentTenant(slug);

  if (!tenant) {
    return null;
  }

  return tenant.content;
}

export default {
  getCurrentTenant,
  getTenantConfig,
  hasFeature,
  isTenantActive,
  getTenantBranding,
  getTenantLimits,
  getTenantContent,
};
