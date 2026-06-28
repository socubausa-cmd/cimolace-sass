import { normalizeTenantBranding } from '@/lib/tenant/tenantBranding';

/**
 * Branding du tenant COURANT, lisible de façon SYNCHRONE — pour le code non-React
 * (modules `lib/`, hooks utilitaires, consts de module) qui ne peut pas appeler le
 * hook `useTenantBranding()`. Remplace les lectures directes de
 * `activeTenantConfig.branding` (qui codaient le tenant fondateur `isna` en dur
 * comme défaut universel du produit).
 *
 * - Avant hydratation : repli conditionné à l'hôte via `normalizeTenantBranding(null)`
 *   (neutre LIRI hors domaine d'un tenant ; identité du fondateur sur son propre
 *   domaine — voir tenantBranding.js).
 * - Après hydratation (au boot, alimentée par `useTenantContext`) : branding du
 *   tenant réellement résolu (domaine custom → DB, ou /t/:slug, ?tenant=).
 *
 * ⚠️ NON réactif. Dans un COMPOSANT React, préférer `useTenantBranding()`
 * (re-render à la résolution). Cet accesseur est pour le code hors-React.
 */
let RESOLVED_BRANDING = null;
let RESOLVED_SLUG = '';
let RESOLVED_ID = '';

/** Alimenté au boot par `useTenantContext` une fois le tenant résolu (ou null). */
export function setActiveTenantBranding(tenant) {
  RESOLVED_BRANDING = tenant ? normalizeTenantBranding(tenant) : null;
  RESOLVED_SLUG = tenant && tenant.slug ? String(tenant.slug).trim().toLowerCase() : '';
  RESOLVED_ID = tenant && (tenant.tenant_id || tenant.id) ? String(tenant.tenant_id || tenant.id) : '';
}

/** Branding du tenant courant (résolu, sinon repli neutre LIRI conditionné à l'hôte). */
export function getActiveTenantBranding() {
  return RESOLVED_BRANDING || normalizeTenantBranding(null);
}

/** Slug du tenant courant résolu ('' si aucun — hôte plateforme / non hydraté). */
export function getActiveTenantSlug() {
  return RESOLVED_SLUG;
}

/** UUID du tenant courant résolu ('' si aucun — hôte plateforme / non hydraté). */
export function getActiveTenantId() {
  return RESOLVED_ID;
}
