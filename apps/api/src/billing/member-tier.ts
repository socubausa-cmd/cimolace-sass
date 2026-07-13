/**
 * member-tier — MIROIR SERVEUR de apps/app/src/lib/liri/memberTier.js. Gating par PALIER de
 * forfait élève (autonome/academique/prive/privilegie), enforcement NON contournable côté API.
 *
 * ⚠️ FEATURE_MIN_RANK doit rester IDENTIQUE au front. Toute modif ici DOIT être répliquée là-bas
 * (et inversement). Axe DISTINCT du tenant (free/trial/paid) : ici c'est le membre qui paie.
 * Gating cumulatif par rang : accès si rang_élève ≥ rang_requis.
 */

export const CYCLE_KEYS = ['autonome', 'academique', 'prive', 'privilegie'] as const;
export type Cycle = (typeof CYCLE_KEYS)[number];

export const CYCLE_RANK: Record<Cycle, number> = { autonome: 1, academique: 2, prive: 3, privilegie: 4 };

export const FEATURE_MIN_RANK: Record<string, number> = {
  coursReplay: 1,
  library: 1,
  temple: 1,
  forum: 1,
  dm: 1,
  coursLive: 2,
  liveCursus: 2,
  dmProfesseur: 2,
  seancePrivee: 3,
  dmMentor: 3,
  mentorat: 4,
  cerclePraticien: 4,
};

/** Extrait le cycle d'une clé de plan billing_plans (ex. 'academique-monthly' → 'academique'). */
export function cycleFromPlanId(planId?: string | null): Cycle | null {
  const m = String(planId || '').toLowerCase().match(/^(autonome|academique|prive|privilegie)(?:-|$)/);
  return m ? (m[1] as Cycle) : null;
}

export function rankOfCycle(cycle?: Cycle | null): number {
  return (cycle && CYCLE_RANK[cycle]) || 0;
}

/** Ce cycle débloque-t-il cette feature ? */
export function cycleCan(cycle: Cycle | null | undefined, feature: string): boolean {
  const min = FEATURE_MIN_RANK[feature];
  return min != null && rankOfCycle(cycle) >= min;
}

/** Le cycle minimal qui débloque une feature (pour messages d'upsell). */
export function minCycleForFeature(feature: string): Cycle | null {
  const min = FEATURE_MIN_RANK[feature];
  if (min == null) return null;
  return (CYCLE_KEYS.find((c) => CYCLE_RANK[c] >= min) as Cycle) || null;
}

/**
 * Un abonnement (status + plan_id) donne-t-il accès à `feature` ?
 * Enforcement serveur : à appeler dans les guards/services avant d'ouvrir une ressource gatée.
 */
export function subscriptionCan(
  sub: { status?: string; plan_id?: string | null } | null | undefined,
  feature: string,
  { inGrace = false }: { inGrace?: boolean } = {},
): boolean {
  if (!sub) return false;
  const active = sub.status === 'active' || (sub.status === 'past_due' && inGrace);
  if (!active) return false;
  return cycleCan(cycleFromPlanId(sub.plan_id), feature);
}
