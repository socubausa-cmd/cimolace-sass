/**
 * Domaines autorisés pour la scène "App secure" (partage application embarquée).
 * - Le host exact est autorisé.
 * - Les sous-domaines sont aussi autorisés (ex: foo.google.com pour google.com).
 *
 * Politique:
 * - production: liste stricte
 * - développement: même liste stricte par défaut, avec option wildcard locale
 *
 * Pour autoriser tous les domaines en dev local:
 *   VITE_SECURE_APP_ALLOW_ALL_IN_DEV=true
 */
const STRICT_ALLOWED_DOMAINS = [
  'prorascience.org',
  'www.prorascience.org',
  'lriphukf.mychariow.shop',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'google.com',
  'www.google.com',
  'docs.google.com',
];

const mode = String(import.meta.env.MODE || '').toLowerCase();
const isDevMode = mode === 'development' || mode === 'dev';
const allowAllInDev =
  isDevMode && String(import.meta.env.VITE_SECURE_APP_ALLOW_ALL_IN_DEV || '').toLowerCase() === 'true';

/**
 * - `*` = autorise tout (dev uniquement, option explicite)
 * - sinon liste de domaines stricte
 */
export const SECURE_APP_ALLOWED_DOMAINS = allowAllInDev ? ['*'] : STRICT_ALLOWED_DOMAINS;

