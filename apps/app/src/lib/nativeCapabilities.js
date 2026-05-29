import { Capacitor } from '@capacitor/core';

/**
 * API unifiée : fonctionnalités « natives » (Capacitor) avec repli web.
 *
 * Intégration des plugins (après `npm i` + `npx cap sync`) :
 * - @capacitor/push-notifications — appeler l'API dans `registerPushNotifications` ci-dessous.
 * - @capacitor/preferences — remplacer le fallback localStorage dans `nativeSetItem` / `nativeGetItem`.
 * - App.addListener('appUrlOpen', …) — deep links, typiquement dans `main.jsx`.
 * - Fichiers / caméra : brancher @capacitor/camera, FilePicker, dans les écrans concernés.
 */

export function isNativeRuntime() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getRuntimeLabel() {
  if (isNativeRuntime()) {
    if (Capacitor.getPlatform() === 'ios') return 'ios';
    if (Capacitor.getPlatform() === 'android') return 'android';
    return 'native';
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches) {
    return 'pwa';
  }
  return 'web';
}

/**
 * Push : web = non branché ici (prévoir Web Push ailleurs) ; natif = à brancher sur le plugin Capacitor.
 */
export async function registerPushNotifications() {
  if (!isNativeRuntime()) {
    return { ok: false, reason: 'web_fallback', message: 'Sur le web, pas d\'enregistrement push natif via ce point d\'entrée.' };
  }
  // eslint-disable-next-line no-console
  console.info(
    '[LIRI] registerPushNotifications: ajoutez @capacitor/push-notifications puis appelez requestPermissions() + register() ici.',
  );
  return { ok: false, reason: 'not_wired' };
}

/** Stockage : même surface d'API ; web = localStorage. */
export async function nativeSetItem(key, value) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(String(key), String(value));
}

export async function nativeGetItem(key) {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(String(key));
}

export function openDeepLink(href) {
  if (typeof window === 'undefined') return;
  window.location.assign(href);
}

export function filePickerWebOnlyMessage() {
  if (isNativeRuntime()) return null;
  return "Sur le web, le navigateur gère le choix de fichier. L'app installée pourra proposer l'appareil photo intégré.";
}

export function canUseAdvancedCamera() {
  return isNativeRuntime();
}
