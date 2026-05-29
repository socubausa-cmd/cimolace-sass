import { ELEVE_MOBILE, ELEVE_MOBILE_BASE } from './eleveMobileRoutes';

/**
 * Rétrocompatibilité : l'app mobile LIRI « client » historique (`/m/liri`) redirige vers `/m/eleve`.
 * Tous les liens générés en code pointent désormais directement sur l'app élève.
 *
 * @deprecated Préférer `ELEVE_MOBILE` / `ELEVE_MOBILE_BASE` pour tout nouveau code.
 */
export const LIRI_MOBILE_BASE = ELEVE_MOBILE_BASE;

/**
 * @deprecated Utiliser `ELEVE_MOBILE` — mêmes cibles (chemins app élève + exceptions web).
 */
export const LIRI_MOBILE = {
  home: ELEVE_MOBILE.home,
  courses: ELEVE_MOBILE.bibliotheque,
  live: ELEVE_MOBILE.live,
  /** Agenda app élève (shell) */
  calendar: `${ELEVE_MOBILE_BASE}/agenda`,
  messages: ELEVE_MOBILE.messages,
  /** Ancien « hub client » → communauté app élève (commerces : à re-designer dans le shell) */
  client: ELEVE_MOBILE.communaute,
  arena: ELEVE_MOBILE.live,
  /** Boutique Sacrée — écran natif app élève */
  shop: ELEVE_MOBILE.shop,
  product: (id) => `${ELEVE_MOBILE_BASE}/bibliotheque?ref=product&pid=${encodeURIComponent(String(id))}`,
  booking: `${ELEVE_MOBILE_BASE}/bibliotheque?ref=booking`,
  appointments: `${ELEVE_MOBILE_BASE}/agenda`,
  orders: `${ELEVE_MOBILE_BASE}/bibliotheque?ref=orders`,
  subscriptions: `${ELEVE_MOBILE_BASE}/forfaits`,
  support: '/support',
  profile: ELEVE_MOBILE.profile,
  neuron: ELEVE_MOBILE.neuron,
  /** Coller un ID de session : même entrée que fin de session côté élève */
  postLive: ELEVE_MOBILE.liveTermine,
  postLiveSession: (sessionId) =>
    `${ELEVE_MOBILE.liveTermine}?${new URLSearchParams({ session: String(sessionId) }).toString()}`,
};

export const LIRI_CLIENT_TAB_IDS = [
  'orders',
  'subscriptions',
  'payments',
  'shop',
  'booking',
  'appointments',
  'support',
  'profile',
];

export function liriClientHubHref(tab) {
  const base = ELEVE_MOBILE.communaute;
  if (tab && LIRI_CLIENT_TAB_IDS.includes(String(tab))) {
    return `${base}?tab=${encodeURIComponent(String(tab))}`;
  }
  return base;
}
