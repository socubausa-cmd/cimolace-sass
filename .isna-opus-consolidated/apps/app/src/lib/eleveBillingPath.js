import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Chaîne mobile : `getPayerPath(plan&interval)` → page paiement → création intent →
 * `getBillingCheckoutPath(id)` → écran checkout + Chariow (`src/lib/eleveMobilePaymentOpenUrl.js`).
 */

/**
 * URL de suivi d’un paiement (checkout) : version web ou parcours `/m/eleve` (shell LIRI élève).
 * @param {string} paymentId
 */
export function getBillingCheckoutPath(paymentId) {
  const id = encodeURIComponent(String(paymentId));
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/m/eleve')) {
    return `${ELEVE_MOBILE.billingCheckoutBase}/${id}`;
  }
  if (import.meta.env?.VITE_APP_VARIANT === 'eleve') {
    return `${ELEVE_MOBILE.billingCheckoutBase}/${id}`;
  }
  return `/billing/checkout/${id}`;
}

/**
 * Page « Effectuer un paiement » (plan, interval, next…) — web ou shell `/m/eleve`.
 * @param {string} [query] — ex. `plan=foo&interval=monthly` ou `?plan=...`
 */
export function getPayerPath(query = '') {
  const q = query.startsWith('?') ? query : query ? `?${query}` : '';
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/m/eleve')) {
    return `/m/eleve/paiements/payer${q}`;
  }
  if (import.meta.env?.VITE_APP_VARIANT === 'eleve') {
    return `/m/eleve/paiements/payer${q}`;
  }
  return `/paiements/payer${q}`;
}

/**
 * Retour e-commerce après checkout (Stripe, etc.) — version web ou shell `/m/eleve`.
 */
export function getCheckoutSuccessPath() {
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/m/eleve')) {
    return '/m/eleve/checkout-success';
  }
  if (import.meta.env?.VITE_APP_VARIANT === 'eleve') {
    return '/m/eleve/checkout-success';
  }
  return '/checkout-success';
}
