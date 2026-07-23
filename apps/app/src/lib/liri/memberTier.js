/**
 * memberTier — droits par PALIER de forfait ÉLÈVE (autonome / academique / prive / privilegie).
 *
 * ⚠️ AXE DISTINCT de liriEntitlements.js. Celui-là gate le TENANT (free|trial|paid = plan SaaS
 * Cimolace : durée live, replay, IA…). ICI on gate le MEMBRE : quel palier l'élève a payé, et ce
 * que CE palier débloque (cours en direct, séances privées, mentorat…). Les deux axes coexistent :
 * le tenant doit avoir LIRI (axe A) ET l'élève doit avoir le bon palier (axe B).
 *
 * Gating CUMULATIF PAR RANG : autonome=1 < academique=2 < prive=3 < privilegie=4. Accès à une
 * feature si rang_élève ≥ rang_requis. Un palier hérite de TOUT ce que débloquent les inférieurs.
 *
 * SOURCE DE VÉRITÉ UNIQUE du gating par palier. Miroir serveur : apps/api/src/billing/member-tier.ts
 * — toute modif de FEATURE_MIN_RANK doit y être répliquée (enforcement serveur non contournable).
 */

export const CYCLE_KEYS = ['autonome', 'academique', 'prive', 'privilegie'];
export const CYCLE_RANK = Object.freeze({ autonome: 1, academique: 2, prive: 3, privilegie: 4 });
export const CYCLE_LABEL = Object.freeze({ autonome: 'Autonome', academique: 'Académique', prive: 'Privé', privilegie: 'Privilégié' });

/** Extrait le cycle d'une clé de plan billing_plans (ex. 'academique-monthly' → 'academique'). */
export function cycleFromPlanId(planId) {
  const m = String(planId || '').toLowerCase().match(/^(autonome|academique|prive|privilegie)(?:-|$)/);
  return m ? m[1] : null;
}

/** Rang d'un cycle (0 si inconnu / aucun forfait). */
export function rankOfCycle(cycle) { return CYCLE_RANK[cycle] || 0; }

/**
 * Rang minimal requis PAR FEATURE (= la matrice d'accès cible). Accès si rang_élève ≥ valeur.
 * 1=Autonome  2=Académique  3=Privé  4=Privilégié.
 */
export const FEATURE_MIN_RANK = Object.freeze({
  coursReplay: 1,      // cours enregistrés (VOD / replay)
  library: 1,          // bibliothèque · livres fondamentaux
  temple: 1,           // Temple & cultes en direct (signature Autonome)
  forum: 1,            // forum : lire + poster
  dm: 1,               // messagerie pairs + secrétariat
  coursLive: 2,        // cours EN DIRECT, temps réel (signature Académique)
  liveCursus: 2,       // lives du cursus inclus
  dmProfesseur: 2,     // DM professeurs
  seancePrivee: 3,     // séances privées 1:1 incluses (signature Privé)
  dmMentor: 3,         // DM mentor
  mentorat: 4,         // devenir praticien : mentorat + stages (signature Privilégié)
  cerclePraticien: 4,  // cercle praticiens (+ rôle practitioner octroyé)
});

export const FEATURE_KEYS = Object.keys(FEATURE_MIN_RANK);

/** Ce cycle débloque-t-il cette feature ? */
export function cycleCan(cycle, feature) {
  const min = FEATURE_MIN_RANK[feature];
  return min != null && rankOfCycle(cycle) >= min;
}

/** Le cycle MINIMAL qui débloque une feature (pour le CTA « Débloqué dès X → »). null si inconnue. */
export function minCycleForFeature(feature) {
  const min = FEATURE_MIN_RANK[feature];
  if (min == null) return null;
  return CYCLE_KEYS.find((c) => CYCLE_RANK[c] >= min) || null;
}

/** Le prochain palier au-dessus d'un cycle (pour l'upsell). null si déjà au sommet / inconnu. */
export function nextCycle(cycle) {
  const r = rankOfCycle(cycle);
  if (!r || r >= CYCLE_KEYS.length) return null;
  return CYCLE_KEYS[r]; // r est 1-based → index r = palier suivant
}

/** Objet de droits { feature: bool } pour un cycle donné. */
export function entitlementsForCycle(cycle) {
  const out = {};
  for (const f of FEATURE_KEYS) out[f] = cycleCan(cycle, f);
  return out;
}

/**
 * Résout le palier de l'élève depuis le contexte billing.
 * @param {{ status?: string, inGrace?: boolean, planId?: string|null }} ctx
 * @returns {{ hasForfait: boolean, cycle: string|null, rank: number, label: string|null,
 *            can: (feature:string)=>boolean, entitlements: object }}
 */
// ─── ESSAI DE LANCEMENT (offre fondateur) ─────────────────────────────────────
// Quiconque rejoint Prorascience via le lien a un ACCÈS COMPLET GRATUIT à TOUT (Temple + Academy)
// jusqu'au 5 août 2026 inclus — « version d'essai ». Après cette date FIXE, le gating par tier PAYÉ
// reprend (Autonome=Temple/biblio/forum, Académique=+cours live, etc., sinon mur d'upgrade). Verrou
// GLOBAL : aucune trace d'essai par-utilisateur — l'appartenance (join via le lien) suffit, la date
// fait le reste. ⚠️ Doit rester IDENTIQUE au miroir serveur apps/api/src/billing/member-tier.ts.
export const LAUNCH_TRIAL_ENDS_AT = Date.parse('2026-08-05T23:59:59+02:00');
export function isLaunchTrialActive(now = Date.now()) {
  return Number.isFinite(LAUNCH_TRIAL_ENDS_AT) && now <= LAUNCH_TRIAL_ENDS_AT;
}
export function launchTrialDaysLeft(now = Date.now()) {
  return isLaunchTrialActive(now) ? Math.max(0, Math.ceil((LAUNCH_TRIAL_ENDS_AT - now) / 86400000)) : 0;
}

export function resolveMemberTier({ status, inGrace = false, planId = null } = {}) {
  const active = status === 'active' || (status === 'past_due' && inGrace);
  const cycle = active ? cycleFromPlanId(planId) : null; // le VRAI cycle PAYÉ (null si aucun)
  const trial = isLaunchTrialActive();                    // essai de lancement encore ouvert ?
  return {
    hasForfait: active || trial,       // pendant l'essai, accès ouvert même sans forfait payé
    cycle,                             // forfait réellement payé — pour le BADGE (Autonome/Académique)
    trial,                             // en période d'essai gratuit ?
    trialEndsAt: LAUNCH_TRIAL_ENDS_AT,
    rank: trial ? Math.max(rankOfCycle(cycle), 4) : rankOfCycle(cycle), // essai = accès complet (rang max)
    label: cycle ? CYCLE_LABEL[cycle] : (trial ? 'Essai' : null),
    can: (feature) => trial || cycleCan(cycle, feature), // l'essai débloque TOUT
    entitlements: entitlementsForCycle(cycle),
  };
}
