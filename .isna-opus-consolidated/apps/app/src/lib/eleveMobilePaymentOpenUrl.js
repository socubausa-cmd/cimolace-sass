import { Capacitor } from '@capacitor/core';

/**
 * Parcours paiement mobile LIRI (référence produit) :
 * 1. `/m/eleve/paiements/payer?plan=…&interval=…` — saisie + création `billing_payments` (Chariow).
 * 2. `/m/eleve/billing/checkout/:id` — statut + bouton Chariow (ouvre URL prestataire).
 * 3. Fermeture de la vue Chariow in-app → `browserFinished` → rafraîchir le statut.
 * 4. `/m/eleve/checkout-success` si configuré côté provider (optionnel).
 */

/**
 * Ouvre l’URL du prestataire (Chariow, CinetPay, etc.).
 * - **Capacitor** : in-app (Chrome Custom Tabs / SFSafari) via `@capacitor/browser`.
 * - **Web** : `window.open` (nouvel onglet), inchangé.
 *
 * @param {string} url
 */
export async function openPaymentCheckoutUrl(url) {
  const u = String(url || '').trim();
  if (!u) return;
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({
      url: u,
      toolbarColor: '#0B0B0F',
    });
    return;
  }
  window.open(u, '_blank', 'noopener,noreferrer');
}

/**
 * Android & iOS : l’utilisateur a fermé la vue navigateur in-app (Chariow, etc.).
 *
 * @param {() => void} callback
 * @returns {Promise<() => void>} désinscrire l’écoute
 */
export async function subscribePaymentBrowserFinished(callback) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return () => {};
  }
  if (typeof callback !== 'function') return () => {};
  const { Browser } = await import('@capacitor/browser');
  const handle = await Browser.addListener('browserFinished', () => {
    try {
      callback();
    } catch {
      /* ignore */
    }
  });
  return () => {
    try {
      handle.remove();
    } catch {
      /* ignore */
    }
  };
}

/**
 * L’app repasse au premier plan (utile si le checkout s’ouvre dans le navigateur externe / Safari).
 *
 * @param {() => void} callback
 * @returns {Promise<() => void>}
 */
export async function subscribeAppResumeForPayment(callback) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return () => {};
  }
  if (typeof callback !== 'function') return () => {};
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('appStateChange', (s) => {
    if (s.isActive) {
      try {
        callback();
      } catch {
        /* ignore */
      }
    }
  });
  return () => {
    try {
      handle.remove();
    } catch {
      /* ignore */
    }
  };
}
