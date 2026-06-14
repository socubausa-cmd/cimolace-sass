/**
 * Mapping PLAN → MOTEURS (tenant_services) — le « squelette » qui relie un
 * paiement à l'activation réelle du produit.
 *
 * Modèle commercial (décision 2026-06-14) : PACKS + ADD-ONS à la carte.
 *  - Packs (bundles) : starter / pro / business (école LIRI), medos_standard,
 *    zahir-forfait (MEDOS + mbolo + LIRI).
 *  - Add-ons (à la carte) : addon_liri_live (cœur « concurrent Zoom »),
 *    addon_liri_brain, addon_mbolo, addon_medos.
 *
 * Les clés de service correspondent EXACTEMENT à `ENGINE_CATALOG`
 * (apps/api/src/cimolace/service-catalog.service.ts → table `tenant_services`).
 *
 * SOURCE DE VÉRITÉ : `billing_plans.features.services` (tableau de clés) prime si
 * présent (override DB, data-driven) ; sinon ce manifeste sert de repli. Ainsi un
 * nouveau plan peut porter sa propre liste en DB sans toucher au code, mais les
 * plans connus fonctionnent même avant migration.
 */

// Socle commun LIRI (toujours inclus dans une offre école/live).
const LIRI_BASE = [
  "liri_brain",
  "forum",
  "chat_engine",
  "calendar",
  "notif_engine",
  "email_engine",
  "activity_stream",
];

const MEDOS_ENGINES = [
  "med_ehr",
  "med_notes",
  "med_prescriptions",
  "med_forms",
  "med_health",
  "med_programs",
  "med_charting",
  "gdpr_engine",
  "calendar",
  "notif_engine",
];

const MBOLO_ENGINES = [
  "pay_engine",
  "cinetpay",
  "sms_engine",
  "whatsapp_engine",
  "notif_engine",
];

// Tiers école LIRI (cumulatifs).
const LIRI_STARTER = [...LIRI_BASE, "liri_live", "course_builder", "marketing_creator"];
const LIRI_PRO = [...LIRI_STARTER, "liri_smartboard", "liri_replay", "liri_masterclass", "studio_creator"];
const LIRI_BUSINESS = [
  ...LIRI_PRO,
  "liri_neuro_recall",
  "workflow_engine",
  "webhook_engine",
  "stripe_connect",
  "template_engine",
];

/** Déduplique en conservant l'ordre. */
const uniq = (arr: string[]): string[] => Array.from(new Set(arr));

export const PLAN_SERVICE_MAP: Record<string, string[]> = {
  // ── Packs école LIRI ──────────────────────────────────────────────────────
  starter: uniq(LIRI_STARTER),
  pro: uniq(LIRI_PRO),
  business: uniq(LIRI_BUSINESS),

  // ── MEDOS / forfait mixte ─────────────────────────────────────────────────
  medos_standard: uniq(MEDOS_ENGINES),
  // zahirwellness : un seul forfait couvre MEDOS + mbolo + LIRI live.
  "zahir-forfait": uniq([...MEDOS_ENGINES, ...MBOLO_ENGINES, "liri_live", "liri_brain"]),

  // ── Add-ons à la carte ────────────────────────────────────────────────────
  // Cœur « LIRI = concurrent de Zoom » : lives + replay + studio + IA.
  addon_liri_live: uniq(["liri_live", "liri_replay", "studio_creator", ...LIRI_BASE]),
  addon_liri_brain: uniq(["liri_brain", "liri_masterclass", "liri_smartboard", "liri_neuro_recall"]),
  addon_mbolo: uniq(MBOLO_ENGINES),
  addon_medos: uniq(MEDOS_ENGINES),
};

/**
 * Résout la liste des moteurs à activer pour un plan.
 * Priorité : `billing_plans.features.services` (DB) > manifeste > [].
 */
export function resolvePlanServices(planKey: string | null | undefined, features?: unknown): string[] {
  const f = features as { services?: unknown } | null | undefined;
  const fromDb = Array.isArray(f?.services)
    ? (f!.services as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  if (fromDb.length) return uniq(fromDb);
  if (planKey && PLAN_SERVICE_MAP[planKey]) return PLAN_SERVICE_MAP[planKey];
  return [];
}
