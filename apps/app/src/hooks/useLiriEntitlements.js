import { useBilling } from '@/contexts/BillingContext';
import { resolveLiriTier, liriEntitlements } from '@/lib/liri/liriEntitlements';

/**
 * Palier LIRI + limites effectives du tenant courant (Couche A : Cimolace facture
 * le tenant). Source de vérité React pour TOUT le gating UI + l'enforcement front.
 *
 * Lit `BillingContext` (status none|active|past_due|expired + inGrace). `trialEndsAt`
 * sera exposé par BillingContext à l'étape 2 (signup pose trial_ends_at = +7j) →
 * ce hook le prendra automatiquement en compte (forward-compatible).
 *
 * Usage :
 *   const { tier, limits, isFree } = useLiriEntitlements();
 *   if (isFree && elapsedMin >= limits.maxLiveMinutes) stopLive();
 *   {limits.canReplay ? <ReplayButton/> : <UpgradeHint/>}
 */
export function useLiriEntitlements() {
  const billing = useBilling() || {};
  const tier = resolveLiriTier({
    billingStatus: billing.status,
    inGrace: billing.inGrace,
    trialEndsAt: billing.trialEndsAt ?? null,
  });
  const limits = liriEntitlements(tier);
  return {
    loading: Boolean(billing.loading),
    tier,
    limits,
    isFree: tier === 'free',
    isTrial: tier === 'trial',
    isPaid: tier === 'paid',
  };
}

export default useLiriEntitlements;
