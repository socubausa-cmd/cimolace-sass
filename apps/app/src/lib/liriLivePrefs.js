/**
 * Préférence locale « mode basse conso / audio-first » pour les salles live.
 * Quand actif, la réception des CAMÉRAS distantes est coupée (setSubscribed(false)),
 * tout en gardant l'audio et le partage d'écran/slides. Vrai levier downlink pour
 * les connexions faibles (Afrique 3G) — cf. [[livekit-lowbandwidth-uplink]].
 */
export const LIRI_LIVE_DATA_SAVER_KEY = 'liri-live-data-saver-v1';

/** Événement custom pour synchroniser le flag dans l'onglet courant (après écriture). */
export const LIRI_LIVE_DATA_SAVER_EVENT = 'liri-live-data-saver';

export function readLiveDataSaver() {
  try {
    return localStorage.getItem(LIRI_LIVE_DATA_SAVER_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLiveDataSaver(value) {
  try {
    if (value) localStorage.setItem(LIRI_LIVE_DATA_SAVER_KEY, '1');
    else localStorage.removeItem(LIRI_LIVE_DATA_SAVER_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LIRI_LIVE_DATA_SAVER_EVENT));
  }
}
