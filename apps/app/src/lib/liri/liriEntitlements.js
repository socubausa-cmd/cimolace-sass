/**
 * Droits & limites LIRI par palier (source de vérité unique).
 *
 * Modèle (décision produit 2026-06-24) — 2 couches :
 *  A) Cimolace facture le TENANT (ce fichier) :
 *     - GRATUIT : live 3 min / 5 pers, PAS de replay, PAS de smartboard IA / NeuroRecall,
 *       1 live à la fois (pas de programmé).
 *     - ESSAI : 7 jours tout débloqué, puis bascule en gratuit si pas payé.
 *     - PAYANT : grille Cimolace (START 150€/mois …) → tout débloqué.
 *  B) le TENANT facture SES clients via ses propres providers (offering-checkout / TenantPaymentConfig).
 *
 * Tout l'enforcement (durée/participants du live, gating replay/IA/programmé, paywall)
 * DOIT lire `liriEntitlements(tier)` — ne jamais recoder une limite ailleurs.
 */

export const LIRI_TRIAL_DAYS = 7;

/** Limites du palier GRATUIT (le « vrai » gating ; l'accès au portail reste ouvert pour l'essai). */
export const LIRI_FREE_LIMITS = Object.freeze({
  maxLiveMinutes: 3,
  maxParticipants: 5,
  maxConcurrentLives: 1,
  canReplay: false,
  canSmartboardAI: false,
  canNeuroRecall: false,
  canSchedule: false,
});

/** Palier débloqué (essai ou payant) — aucune limite. */
export const LIRI_FULL_LIMITS = Object.freeze({
  maxLiveMinutes: null,
  maxParticipants: null,
  maxConcurrentLives: null,
  canReplay: true,
  canSmartboardAI: true,
  canNeuroRecall: true,
  canSchedule: true,
});

/**
 * Palier LIRI d'un tenant : 'paid' | 'trial' | 'free'.
 * @param {{ billingStatus?: string, inGrace?: boolean, trialEndsAt?: string|number|Date|null, now?: number }} ctx
 */
export function resolveLiriTier({ billingStatus, inGrace = false, trialEndsAt = null, now = Date.now() } = {}) {
  if (billingStatus === 'active' || (billingStatus === 'past_due' && inGrace)) return 'paid';
  if (trialEndsAt) {
    const ends = trialEndsAt instanceof Date ? trialEndsAt.getTime() : new Date(trialEndsAt).getTime();
    if (Number.isFinite(ends) && ends > now) return 'trial';
  }
  return 'free';
}

/** Droits/limites effectifs selon le palier. */
export function liriEntitlements(tier) {
  return tier === 'free' ? LIRI_FREE_LIMITS : LIRI_FULL_LIMITS;
}

/** Raccourci : droits effectifs depuis le contexte billing. */
export function resolveLiriEntitlements(ctx) {
  return liriEntitlements(resolveLiriTier(ctx));
}
