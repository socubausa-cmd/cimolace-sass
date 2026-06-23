/**
 * Identité NEUTRE de la plateforme **LIRI** (le PRODUIT Cimolace).
 *
 * Utilisée comme repli quand AUCUN tenant n'est résolu :
 *  - hôte plateforme (`app.cimolace.space`, `*.cimolace.space`),
 *  - dev local (`localhost`),
 *  - routes globales sans contexte tenant.
 *
 * Règle d'archi (cf. docs/CIMOLACE_ARCHITECTURE.md) : Cimolace = SaaS, LIRI = le
 * produit multi-tenant, `isna`/prorascience = juste le 1er tenant. On ne retombe
 * JAMAIS sur l'identité d'un tenant comme défaut universel du produit.
 *
 * NB : couleurs = celles du shell sombre de l'app (neutres), pas la vitrine claire
 * d'un tenant (qui casserait le shell). Accent = violet de marque LIRI.
 */
export const LIRI_PLATFORM_BRANDING = {
  slug: '',
  name: 'LIRI',
  fullName: 'LIRI — Intelligence Live Augmentée',
  shortName: 'LIRI',
  logo: '/liri-logo-mark.png',
  favicon: '/liri-logo-mark.png',
  primaryColor: '#0b1115',
  secondaryColor: '#162331',
  accentColor: '#7c3aed',
  backgroundColor: '#0b1115',
  domain: '',
  publicSiteOrigin: '',
  vitrineContactEmail: '',
};

export default LIRI_PLATFORM_BRANDING;
