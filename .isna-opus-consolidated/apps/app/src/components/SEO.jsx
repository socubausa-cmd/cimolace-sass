import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SITE_URL = (isnaTenantConfig.branding.publicSiteOrigin || `https://${isnaTenantConfig.branding.domain}`).replace(
  /\/$/,
  '',
);
const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;
const DEFAULT_DESC = `${isnaTenantConfig.branding.fullName} — école en ligne et modèle métaphysique africain (5ᵉ Manikongo — Ngowazulu). Formations, accompagnement et bibliothèque d'ouvrages fondateurs. L'espace membre complet s'ouvre dans LIRI après connexion.`;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og.svg`;

const SEO = ({
  title,
  description = DEFAULT_DESC,
  type = 'website',
  image = DEFAULT_OG_IMAGE,
  jsonLd = null,
  noindex = false,
  /** URL absolue préférée (ex. page d’accueil unique pour plusieurs routes) */
  canonical = null,
}) => {
  const { pathname } = useLocation();
  const url = canonical || `${SITE_URL}${pathname}`;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
