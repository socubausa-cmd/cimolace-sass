/**
 * ═══════════════════════════════════════════════════════════════
 * CONFIG DU TENANT ACTIF — seam unique (RÉSOLU PAR L'HÔTE)
 * ───────────────────────────────────────────────────────────────
 * C'est le SEUL endroit de l'app qui importe une config tenant en dur.
 * Tout le reste du code importe `activeTenantConfig` depuis ce module,
 * jamais `@/tenants/isna/...` directement.
 *
 * Cimolace est multi-tenant ; ISNA (Prorascience) n'est qu'UN tenant — le
 * fondateur. Le PRODUIT, c'est LIRI (neutre). Ce module résout, AU CHARGEMENT
 * et de façon SYNCHRONE, l'identité par défaut selon l'hôte :
 *
 *   • Hôte du fondateur (prorascience.org / isna.pro, dérivé de SA config) → ISNA.
 *     Détection FIABLE (apex + sous-domaines), ZÉRO dépendance au cache localStorage
 *     → le site LIVE prorascience.org affiche TOUJOURS ISNA, même au tout 1er rendu.
 *   • Hôte plateforme / dev (cimolace.space, localhost) → identité NEUTRE LIRI.
 *   • Autre domaine custom → neutre LIRI (le branding réel du tenant arrive ensuite
 *     en async via fetchTenantContext/useTenantBranding + la table tenant_domains).
 *
 * ⚠️ `activeTenantConfig` est une CONSTANTE évaluée une seule fois : la détection
 *    de l'hôte fondateur ne doit donc PAS dépendre d'un cache hydraté en async
 *    (sinon flash/branding faux au cold-load). On la dérive du domaine fondateur.
 *
 * Les sites qui ont besoin de l'identité ISNA *littérale* (slug 'isna', origine
 * native, liens /t/isna/...) importent `FOUNDER_TENANT_CONFIG`, pas le seam résolu.
 *
 * Cf. docs/CIMOLACE_ARCHITECTURE.md (Cimolace=SaaS · LIRI=produit · isna=1 tenant).
 * ═══════════════════════════════════════════════════════════════
 */
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';
import {
  isPlatformOrDevHost,
  getCachedHostTenant,
  getCachedTenantSettings,
  getCachedHostBranding,
} from '@/lib/tenantResolver';
import { LIRI_PLATFORM_BRANDING } from '@/lib/tenant/liriPlatformBranding';

/** Config du tenant FONDATEUR (ISNA) — identité LITTÉRALE, ne change jamais.
 *  À importer là où on cible ISNA spécifiquement (slug 'isna', origine native…). */
export const FOUNDER_TENANT_CONFIG = isnaTenantConfig;

/** Slug du tenant fondateur (pour la résolution + comparaisons). */
export const FOUNDER_SLUG = String(isnaTenantConfig?.slug || '').trim().toLowerCase();

/**
 * Identité NEUTRE du PRODUIT LIRI (aucun tenant) — MÊME FORME que la config tenant
 * pour rester un drop-in pour les ~65 consommateurs. Branding neutre LIRI, mais
 * `publicSiteOrigin`/`domain` NON VIDES (les canonicals/SEO et le repli API natif
 * en dépendent), pointés sur la plateforme.
 */
export const LIRI_NEUTRAL_CONFIG = {
  id: '',
  slug: '',
  name: LIRI_PLATFORM_BRANDING.name,
  email: '',
  status: 'active',
  // Le produit LIRI expose tous ses moteurs (features = niveau produit, pas tenant).
  features: { ...(isnaTenantConfig.features || {}) },
  limits: { ...(isnaTenantConfig.limits || {}) },
  branding: {
    name: LIRI_PLATFORM_BRANDING.name,
    fullName: LIRI_PLATFORM_BRANDING.fullName,
    logo: LIRI_PLATFORM_BRANDING.logo,
    favicon: LIRI_PLATFORM_BRANDING.favicon,
    primaryColor: LIRI_PLATFORM_BRANDING.primaryColor,
    secondaryColor: LIRI_PLATFORM_BRANDING.secondaryColor,
    // Accent canonique du PORTAIL LIRI = terracotta #d97757 (cf. LiriPortalShell /
    // LoginPage), pas le violet historique. C'est lui qui pilote --school-accent
    // par défaut sur la plateforme (l'or #D4AF37 reste celui d'ISNA, sur son domaine).
    accentColor: '#d97757',
    backgroundColor: LIRI_PLATFORM_BRANDING.backgroundColor,
    // Non vides : canonicals/OG + repli API natif ne doivent jamais être vides.
    domain: 'app.cimolace.space',
    publicSiteOrigin: 'https://app.cimolace.space',
    vitrineContactEmail: '',
  },
  // Libellés génériques (Formation/Module/Leçon…) valides pour LIRI ; messages neutres.
  content: {
    messages: {
      welcome: 'Bienvenue sur LIRI',
      loginSuccess: 'Connexion réussie',
      logoutSuccess: 'Déconnexion réussie',
      enrollmentSuccess: 'Inscription réussie',
      paymentSuccess: 'Paiement effectué avec succès',
    },
    labels: { ...((isnaTenantConfig.content && isnaTenantConfig.content.labels) || {}) },
    descriptions: { ...((isnaTenantConfig.content && isnaTenantConfig.content.descriptions) || {}) },
  },
  metadata: { language: 'fr', timezone: 'Europe/Paris', currency: 'EUR' },
};

/**
 * Domaines du fondateur, DÉRIVÉS de sa config (publicSiteOrigin + domain),
 * sans 'www.'. On matche l'apex ET tous ses sous-domaines.
 */
const FOUNDER_DOMAINS = (() => {
  const out = new Set();
  const add = (raw) => {
    const v = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');
    if (v) out.add(v);
  };
  add(isnaTenantConfig?.branding?.publicSiteOrigin); // prorascience.org
  add(isnaTenantConfig?.branding?.domain); // isna.pro
  return out;
})();

/** L'hôte courant appartient-il au tenant fondateur ? (apex ou sous-domaine) */
function isFounderHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return false;
  for (const d of FOUNDER_DOMAINS) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  return false;
}

/**
 * Config GÉNÉRIQUE d'un tenant à domaine perso, construite depuis le cache
 * host→branding (hydraté par hydrateHostTenant). MÊME FORME que la config tenant
 * (drop-in pour les ~65 consommateurs) : le tenant affiche SON identité (nom,
 * logo, couleurs) dès le premier paint — exactement comme le fondateur, sans
 * config littérale dans le code. Champs non brandés → défauts neutres LIRI.
 */
function buildCachedTenantConfig(host, slug) {
  const b = getCachedHostBranding(host) || {};
  const colors = b.brand_colors && typeof b.brand_colors === 'object' ? b.brand_colors : {};
  const name = String(b.name || '').trim() || LIRI_NEUTRAL_CONFIG.name;
  return {
    ...LIRI_NEUTRAL_CONFIG,
    slug,
    name,
    branding: {
      ...LIRI_NEUTRAL_CONFIG.branding,
      name,
      fullName: name,
      logo: String(b.logo_url || '').trim() || LIRI_NEUTRAL_CONFIG.branding.logo,
      primaryColor: colors.primary || LIRI_NEUTRAL_CONFIG.branding.primaryColor,
      secondaryColor: colors.secondary || LIRI_NEUTRAL_CONFIG.branding.secondaryColor,
      accentColor: colors.accent || colors.primary || LIRI_NEUTRAL_CONFIG.branding.accentColor,
      // Canonicals/SEO + repli API : le domaine du tenant lui-même.
      domain: host,
      publicSiteOrigin: `https://${host}`,
    },
  };
}

/** Résolution SYNCHRONE de l'identité par défaut selon l'hôte (voir en-tête). */
function resolveActiveTenantConfig() {
  const host =
    typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
  // 1) Domaine du fondateur → ISNA, de façon fiable (jamais de cache requis).
  if (isFounderHost(host)) return FOUNDER_TENANT_CONFIG;
  // 2) Plateforme / dev (cimolace.space, localhost, build sans window) → LIRI neutre.
  if (isPlatformOrDevHost(host)) return LIRI_NEUTRAL_CONFIG;
  // 3) Autre domaine custom : résolu par le cache host→slug (hydraté au boot —
  //    cf. le gate de main.tsx qui ATTEND l'hydratation au tout premier visit).
  //    Fondateur → sa config littérale ; TOUT AUTRE tenant → config générique
  //    construite depuis le cache branding (nom/logo/couleurs de l'org). Plus de
  //    privilège fondateur : chaque client à domaine perso a son identité au boot.
  const cachedSlug = getCachedHostTenant(host);
  if (cachedSlug) {
    if (FOUNDER_SLUG && cachedSlug === FOUNDER_SLUG) return FOUNDER_TENANT_CONFIG;
    return buildCachedTenantConfig(host, cachedSlug);
  }
  return LIRI_NEUTRAL_CONFIG;
}

/** Config du tenant actif (par défaut, résolue par l'hôte courant). */
export const activeTenantConfig = resolveActiveTenantConfig();

/**
 * Gating « dossier élève » (KYC certificats) résolu de façon SYNCHRONE pour les
 * gardes de routage. Priorité :
 *   1. réglage tenant en cache (hydraté depuis la DB via le back-office) si défini ;
 *   2. sinon repli sur la config résolue par l'hôte (founder ISNA = true par défaut,
 *      LIRI neutre / autre tenant non configuré = false).
 * → activable/désactivable par tenant depuis /admin/settings, sans toucher au code.
 */
export function resolveRequiresStudentDossier() {
  const host =
    typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
  const cached = getCachedTenantSettings(host);
  if (cached && typeof cached.requiresStudentDossier === 'boolean') {
    return cached.requiresStudentDossier;
  }
  return !!activeTenantConfig.requiresStudentDossier;
}

export default activeTenantConfig;
