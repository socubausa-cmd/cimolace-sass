/**
 * Marque produit CIMOLACE (plateforme SaaS) — distincte d'ISNA / PRORASCIENCE.
 * Utiliser ces constantes dans les pages et layouts sous /cimolace/*.
 */

/** Chemins publics CIMOLACE (une seule source pour liens / footer). */
export const cimolacePlatformRoutes = {
  /** Vitrine officielle — contenu et structure alignés sur cimolace.html (clair). */
  home: '/cimolace',
  /** @deprecated Alias de `home` (chemins historiques / `/cimolace/catalog`). */
  catalog: '/cimolace',
  /** Deuxième landing officielle — vitrine immersive sombre (modules, hero animé). */
  landingImmersive: '/cimolace/immersive',
  architecture: '/cimolace/architecture',
  hosting: '/cimolace/hebergement',
  configurateur: '/cimolace/configurateur',
  solutions: '/cimolace/products',
  comparison: '/cimolace/comparaison',
  about: '/cimolace/about',
  contact: '/cimolace/contact',
  installer: '/cimolace/installer',
  paymentSetup: '/cimolace/paiement/setup',
  booking: '/cimolace/booking',
  dashboard: '/cimolace/dashboard',
  subscription: '/cimolace/abonnement',
  legalPrivacy: '/cimolace/legal/confidentialite',
  legalTerms: '/cimolace/legal/cgu',
  legalCookies: '/cimolace/legal/cookies',
  companyCareers: '/cimolace/company/carrieres',
  companyBlog: '/cimolace/company/blog',
  companyPress: '/cimolace/company/presse',
  resourcesDocs: '/cimolace/resources/documentation',
  resourcesApi: '/cimolace/resources/api',
  resourcesGuide: '/cimolace/resources/guide',
  resourcesSupport: '/cimolace/resources/support',
};

export const cimolacePlatformConfig = {
  productName: 'CIMOLACE',
  /** Pipeline pédagogique IA (vitrine produit — aligné LIRI School, pas le nom du tenant école) */
  schoolPipelineProductName: 'LIRI Pipeline™',
  routes: cimolacePlatformRoutes,
  /** Sous-titre court sous le logo (login, header) — pas de renvoi à une autre marque */
  logoTagline: "L'OS du commerce numérique",
  /** Domaine vitrine (affichage texte / liens ; DNS réel du déploiement) */
  marketingSiteDisplay: 'cimolace.space',
  /** Email contact vitrine CIMOLACE (mailto / footer) */
  contactEmail: 'contact@cimolace.com',
  /** Ligne copyright pied de page (sans mélange ISNA/PRORASCIENCE) */
  get copyrightLine() {
    return `© ${new Date().getFullYear()} ${this.productName}`;
  },
  /** Variante micro (bas de page marketing) */
  get copyrightMicro() {
    return `© ${new Date().getFullYear()} ${this.productName}`;
  },
  /** Footer type « offre Virtuel Mbolo » (site principal → CIMOLACE) */
  get copyrightVirtuelMboloCimolace() {
    return `© ${new Date().getFullYear()} Virtuel-Mbolo™ — ${this.productName}`;
  },
};

export default cimolacePlatformConfig;
