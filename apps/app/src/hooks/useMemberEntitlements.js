import { useMemo } from 'react';
import { useBilling } from '@/contexts/BillingContext';
import { useAuth } from '@/hooks/useAuth';
import {
  resolveMemberTier, minCycleForFeature, nextCycle, CYCLE_LABEL,
} from '@/lib/liri/memberTier';

// Rôles qui BYPASSENT le gating par palier (même logique que ProtectedLiriRoute/LiriAccessGate) :
// le staff n'achète pas de forfait et voit tout.
const STAFF_ROLES = new Set(['owner', 'admin', 'teacher', 'secretariat', 'practitioner', 'clinic_admin']);

/**
 * Palier de forfait de l'ÉLÈVE + droits par feature (axe B — le membre paie le tenant).
 * À utiliser dans TOUTE surface qui doit différencier l'accès selon le forfait :
 *
 *   const { can, cycle, upsellFor } = useMemberEntitlements();
 *   if (!can('coursLive')) return <UpsellLock feature="coursLive" {...upsellFor('coursLive')} />;
 *
 * Le staff (owner/teacher/…) obtient toujours can()===true. Distinct de useLiriEntitlements()
 * (axe A : le TENANT a-t-il LIRI). Les deux doivent passer pour accéder à une feature payante.
 */
export function useMemberEntitlements() {
  const billing = useBilling() || {};
  const { user } = useAuth() || {};

  const role = String(user?.role || '').toLowerCase();
  const tRole = String(user?.tenant_role || '').toLowerCase();
  const isStaff = STAFF_ROLES.has(role) || STAFF_ROLES.has(tRole);

  const planId = billing.subscription?.plan_id || null;
  const status = billing.status;
  const inGrace = billing.inGrace;

  return useMemo(() => {
    const tier = resolveMemberTier({ status, inGrace, planId });
    const can = (feature) => isStaff || tier.can(feature);
    return {
      loading: Boolean(billing.loading),
      isStaff,
      cycle: tier.cycle,
      label: tier.label,
      rank: isStaff ? 99 : tier.rank,
      hasForfait: tier.hasForfait || isStaff,
      can,
      entitlements: tier.entitlements,
      // Upsell : pour une feature verrouillée, le palier minimal qui la débloque + le libellé + le plan cible.
      upsellFor: (feature) => {
        const target = minCycleForFeature(feature);
        return {
          locked: !can(feature),
          minCycle: target,
          minCycleLabel: target ? CYCLE_LABEL[target] : null,
          planKey: target ? `${target}-monthly` : null,
          nextCycle: nextCycle(tier.cycle),
        };
      },
    };
  }, [status, inGrace, planId, isStaff, billing.loading]);
}

export default useMemberEntitlements;
