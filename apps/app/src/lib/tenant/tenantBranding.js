import { isPlatformOrDevHost, getCachedHostTenant } from '@/lib/tenantResolver';
import { FOUNDER_TENANT_CONFIG } from '@/lib/tenant/activeTenantConfig';
import { LIRI_PLATFORM_BRANDING } from '@/lib/tenant/liriPlatformBranding';

/**
 * Repli de branding quand AUCUN tenant n'est résolu — désormais **conditionné à
 * l'hôte** (le produit LIRI ne « porte » plus un tenant par défaut) :
 *
 *  - hôte plateforme / dev (`app.cimolace.space`, `localhost`) → identité NEUTRE **LIRI**.
 *  - domaine custom du tenant FONDATEUR (cache host→slug === slug founder, ex.
 *    `prorascience.org` → `isna`) → identité du fondateur, SYNCHRONE, pour éviter
 *    un flash LIRI→tenant sur le propre domaine du tenant (anti-FOUC).
 *  - tout autre domaine custom → neutre LIRI en attendant la résolution async (DB).
 *
 * Cf. règle d'archi : Cimolace = SaaS, LIRI = produit, `isna` = juste un tenant.
 * On GARDE les couleurs sombres de l'app (la config tenant peut porter un thème
 * clair de vitrine → casserait le shell).
 */
const ZONES = {
  header: true,
  footer: true,
  publicVitrine: true,
  memberApp: true,
  liveStudio: true,
  adminBackoffice: true,
};

/** Identité NEUTRE LIRI (défaut universel du produit, aucun tenant). */
const LIRI_FALLBACK = {
  name: LIRI_PLATFORM_BRANDING.name,
  fullName: LIRI_PLATFORM_BRANDING.fullName,
  logo: LIRI_PLATFORM_BRANDING.logo,
  favicon: LIRI_PLATFORM_BRANDING.favicon,
  primaryColor: '#0b1115',
  secondaryColor: '#162331',
  accentColor: '#7c3aed',
  backgroundColor: '#0b1115',
  domain: '',
  publicSiteOrigin: '',
  vitrineContactEmail: '',
  shortName: LIRI_PLATFORM_BRANDING.shortName,
  zones: ZONES,
};

/** Identité du tenant FONDATEUR — repli SYNCHRONE uniquement sur SON propre domaine.
 *  TOUJOURS la config fondateur (ISNA), jamais le seam résolu par l'hôte. */
const FOUNDER = (FOUNDER_TENANT_CONFIG && FOUNDER_TENANT_CONFIG.branding) || {};
const FOUNDER_SLUG = String(FOUNDER_TENANT_CONFIG?.slug || '').trim().toLowerCase();
const FOUNDER_FALLBACK = {
  name: FOUNDER.name || LIRI_FALLBACK.name,
  fullName: FOUNDER.fullName || FOUNDER.name || LIRI_FALLBACK.fullName,
  logo: FOUNDER.logo || LIRI_FALLBACK.logo,
  favicon: FOUNDER.favicon || LIRI_FALLBACK.favicon,
  primaryColor: '#0b1115',
  secondaryColor: '#162331',
  accentColor: '#7c3aed',
  backgroundColor: '#0b1115',
  domain: FOUNDER.domain || '',
  publicSiteOrigin: FOUNDER.publicSiteOrigin || '',
  vitrineContactEmail: FOUNDER.vitrineContactEmail || '',
  shortName: FOUNDER.name || 'École',
  zones: ZONES,
};

/** Repli SYNCHRONE selon l'hôte courant — voir doc ci-dessus. */
function resolveFallbackBranding() {
  const host = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
  if (!host || isPlatformOrDevHost(host)) return LIRI_FALLBACK;
  if (FOUNDER_SLUG && getCachedHostTenant(host) === FOUNDER_SLUG) return FOUNDER_FALLBACK;
  return LIRI_FALLBACK;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function normalizeTenantBranding(tenant = null) {
  // Repli résolu À CHAUD selon l'hôte (neutre LIRI hors domaine d'un tenant).
  const FALLBACK_BRANDING = resolveFallbackBranding();
  const source = tenant && typeof tenant === 'object' ? tenant : {};
  const rawBranding = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const brandColors = source.brand_colors && typeof source.brand_colors === 'object' ? source.brand_colors : {};
  const metadataBranding =
    source.metadata?.branding && typeof source.metadata.branding === 'object'
      ? source.metadata.branding
      : {};

  const name = firstString(rawBranding.name, metadataBranding.name, source.name, FALLBACK_BRANDING.name);
  const fullName = firstString(rawBranding.fullName, metadataBranding.fullName, source.business_name, name, FALLBACK_BRANDING.fullName);
  const publicSiteOrigin = firstString(
    rawBranding.publicSiteOrigin,
    metadataBranding.publicSiteOrigin,
    source.public_site_origin,
    source.primary_domain ? `https://${String(source.primary_domain).replace(/^https?:\/\//, '')}` : '',
    FALLBACK_BRANDING.publicSiteOrigin,
  ).replace(/\/$/, '');

  return {
    name,
    fullName,
    logo: firstString(rawBranding.logo, metadataBranding.logo, source.logo_url, FALLBACK_BRANDING.logo),
    favicon: firstString(rawBranding.favicon, metadataBranding.favicon, source.favicon_url, FALLBACK_BRANDING.favicon),
    primaryColor: firstString(rawBranding.primaryColor, metadataBranding.primaryColor, brandColors.primary, FALLBACK_BRANDING.primaryColor),
    secondaryColor: firstString(rawBranding.secondaryColor, metadataBranding.secondaryColor, brandColors.secondary, FALLBACK_BRANDING.secondaryColor),
    accentColor: firstString(rawBranding.accentColor, metadataBranding.accentColor, brandColors.accent, FALLBACK_BRANDING.accentColor),
    backgroundColor: firstString(rawBranding.backgroundColor, metadataBranding.backgroundColor, FALLBACK_BRANDING.backgroundColor),
    domain: firstString(rawBranding.domain, metadataBranding.domain, source.primary_domain, FALLBACK_BRANDING.domain),
    publicSiteOrigin,
    vitrineContactEmail: firstString(
      rawBranding.vitrineContactEmail,
      metadataBranding.vitrineContactEmail,
      source.contact_email,
      source.email,
      FALLBACK_BRANDING.vitrineContactEmail,
    ),
    designSystem:
      metadataBranding.designSystem && typeof metadataBranding.designSystem === 'object'
        ? metadataBranding.designSystem
        : rawBranding.designSystem && typeof rawBranding.designSystem === 'object'
          ? rawBranding.designSystem
          : {},
  };
}

export const defaultTenantBranding = normalizeTenantBranding();
