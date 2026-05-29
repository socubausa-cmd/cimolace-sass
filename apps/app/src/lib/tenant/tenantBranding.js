const FALLBACK_BRANDING = {
  name: 'Mon École',
  fullName: 'Mon École',
  logo: '/logos/isna-logo.png',
  favicon: '/favicons/isna-favicon.ico',
  primaryColor: '#0b1115',
  secondaryColor: '#162331',
  accentColor: '#7c3aed',
  backgroundColor: '#0b1115',
  domain: '',
  publicSiteOrigin: '',
  vitrineContactEmail: '',
  shortName: 'École',
  zones: {
    header: true,
    footer: true,
    publicVitrine: true,
    memberApp: true,
    liveStudio: true,
    adminBackoffice: true,
  },
};

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function normalizeTenantBranding(tenant = null) {
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
