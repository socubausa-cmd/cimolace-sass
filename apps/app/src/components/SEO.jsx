import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const SEO = ({
  title,
  description,
  type = 'website',
  image,
  jsonLd = null,
  noindex = false,
  /** URL absolue préférée (ex. page d'accueil unique pour plusieurs routes) */
  canonical = null,
}) => {
  const { pathname } = useLocation();
  const { branding } = useTenantBranding();
  const siteUrl = (branding.publicSiteOrigin || `https://${branding.domain}`).replace(/\/$/, '');
  const siteName = `${branding.name} · LIRI`;
  const defaultDesc = `${branding.fullName} — école en ligne, formations, accompagnement et bibliothèque. L'espace membre complet s'ouvre dans LIRI après connexion.`;
  const resolvedDescription = description || defaultDesc;
  const resolvedImage = image || `${siteUrl}/og.svg`;
  const url = canonical || `${siteUrl}${pathname}`;
  const fullTitle = title ? `${title} | ${siteName}` : siteName;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />

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
