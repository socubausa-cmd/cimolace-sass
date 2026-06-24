import { Capacitor } from '@capacitor/core';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { shouldUseLiriMobileLogin } from '@/lib/loginEntryPath';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

const defaultPublicWeb = () => getActiveTenantBranding().publicSiteOrigin || (typeof window !== 'undefined' ? window.location.origin : '');

const LS_STUDENT_WEB_LIMITED = 'liri_student_web_limited_opt_in';

/**
 * @returns {boolean} True si l'app tourne dans la WebView Capacitor (Android / iOS).
 */
export function isCapacitorNative() {
  try {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * PWA installée (standalone) — considérée comme « installée » pour ne pas forcer l'écran d'gate.
 */
export function isInstalledWebApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Retour explicite « continuer en web limité » (localStorage). */
export function hasStudentWebLimitedOptIn() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_STUDENT_WEB_LIMITED) === '1';
  } catch {
    return false;
  }
}

export function setStudentWebLimitedOptIn() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_STUDENT_WEB_LIMITED, '1');
  } catch {
    /* quota / privé */
  }
}

export function clearStudentWebLimitedOptIn() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LS_STUDENT_WEB_LIMITED);
  } catch {
    /* ignore */
  }
}

/**
 * `VITE_ENABLE_STUDENT_WEB_FALLBACK=true` : affiche le bouton « Continuer sur le web (limité) »
 * (le 3ᵉ CTA). Ne bloque plus la sortie de l'écran d'installation (opt-in `localStorage`).
 */
export function isStudentWebFallbackEnabled() {
  return import.meta.env.VITE_ENABLE_STUDENT_WEB_FALLBACK === 'true';
}

/**
 * Désactive le gate (dev / QA) — ne pas activer en prod.
 */
export function bypassInstallGateForDev() {
  return import.meta.env.DEV && import.meta.env.VITE_BYPASS_STUDENT_INSTALL_GATE === 'true';
}

/**
 * Indique s'il faut afficher {@link InstallAppGate} sur la page de connexion élève
 * (mobile navigateur, non installé, pas de contournement).
 */
export function shouldShowStudentInstallGate() {
  if (isCapacitorNative()) return false;
  if (bypassInstallGateForDev()) return false;
  if (!shouldUseLiriMobileLogin()) return false;
  if (isInstalledWebApp()) return false;
  // Ne pas exiger VITE_ENABLE_STUDENT_WEB_FALLBACK : l'opt-in sert aussi au bouton « Ouvrir l'app »
  // (même hôte) ; sinon l'enregistrement ne fait jamais quitter l'écran d'installation.
  if (hasStudentWebLimitedOptIn()) return false;
  return true;
}

export function getEleveStoreInstallUrl() {
  const a = import.meta.env.VITE_ELEVE_PLAY_STORE_URL;
  const i = import.meta.env.VITE_ELEVE_APP_STORE_URL;
  if (typeof navigator === 'undefined') return a || i || defaultPublicWeb();
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return i || a || defaultPublicWeb();
  return a || i || defaultPublicWeb();
}

/**
 * L'URL d'ouverture cible le **même hôte** (ex. `/m/eleve/login` en local) : un simple `<a href>` recharge
 * la page **sans** opt-in « web limité » — l'écran `InstallAppGate` reste. Le bouton « Ouvrir l'app » doit
 * alors enregistrer l'opt-in puis basculer vers le formulaire (comme « Continuer sur le web (limité) »).
 * Deep links `https` vers un autre domaine ou schémas natifs : utiliser un lien normal.
 */
export function isSameOriginStudentAppOpenUrl(url) {
  if (typeof window === 'undefined' || !url) return false;
  if (!/^https?:\/\//i.test(String(url))) return false;
  try {
    const u = new URL(String(url), window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Lien profond / URL scheme pour « Ouvrir l'app ».
 * - Schéma natif (ex. org.prorascience...://) : laisser tel quel.
 * - En https : on préfère **connexion compte** (`/m/eleve/login`) + `redirect=/m/eleve` pour
 *   éviter l'écran d'accueil « Rejoindre / vitrine » et tomber directement sur l'espace LIRI après auth.
 */
export function getEleveAppOpenUrl() {
  const custom = import.meta.env.VITE_ELEVE_APP_OPEN_URL;
  if (custom) return normalizeEleveAppOpenUrl(custom);
  return buildLiriAppOpenUrlHttps();
}

function buildLiriAppOpenUrlHttps() {
  const q = new URLSearchParams({ redirect: ELEVE_MOBILE.home }).toString();
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${ELEVE_MOBILE.login}?${q}`;
  }
  return `${defaultPublicWeb()}${ELEVE_MOBILE.login}?${q}`;
}

function normalizeEleveAppOpenUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return buildLiriAppOpenUrlHttps();

  // Schéma natif / app links non-http : on respecte le build.
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    const u = new URL(value);
    const p = (u.pathname || '/').replace(/\/+$/, '') || '/';
    if (p === '/' || p === '' || p === ELEVE_MOBILE.home || p === ELEVE_MOBILE.prorascience) {
      u.pathname = ELEVE_MOBILE.login;
      u.search = new URLSearchParams({ redirect: ELEVE_MOBILE.home }).toString();
      u.hash = '';
      return u.toString();
    }
    if (p === ELEVE_MOBILE.connexion || p.startsWith(`${ELEVE_MOBILE.connexion}/`)) {
      u.pathname = ELEVE_MOBILE.login;
      u.search = new URLSearchParams({ redirect: ELEVE_MOBILE.home }).toString();
      u.hash = '';
      return u.toString();
    }
    return u.toString();
  } catch {
    return value;
  }
}
