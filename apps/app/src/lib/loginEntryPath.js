import { Capacitor } from '@capacitor/core';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Entrée **LIRI** (app membre) — distincte du seul portail vitrine. Voir `liriVitrineModel.js`.
 *
 * La coque LIRI `/m/eleve` (login + écran « installez l'app ») est réservée à
 * l'app **native Capacitor**. Un navigateur mobile reste sur le web responsive
 * (`/login`, `/student-school-life`…). Décision produit 2026-06-21 :
 * « mobile web = web responsive, jamais la version coque/Capacitor ».
 * (Avant : tout écran ≤1023px basculait sur la coque → « version capacitore » sur mobile web.)
 */
export function shouldUseLiriMobileLogin() {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * URL de la page de connexion : `/m/eleve/login` sur mobile, `/login` sur grand écran.
 * Sans `window` (tests / prerender) : `/login`.
 */
export function getLoginEntryPath() {
  if (typeof window === 'undefined') return '/login';
  return shouldUseLiriMobileLogin() ? ELEVE_MOBILE.login : '/login';
}

/** Query string : forcer l'écran classique (éviter la redirection auto mobile). */
export const FORCE_DESKTOP_LOGIN_PARAM = 'forceDesktop';

/**
 * Cible de connexion avec paramètres d'URL (`next`, `redirect`, `forceDesktop`, etc.).
 * @param {Record<string, string | number | null | undefined>} query
 * @returns {string}
 */
export function getLoginPathWithQuery(query) {
  const path = getLoginEntryPath();
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v == null || v === '') continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}
