import { Injectable, ForbiddenException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

/**
 * Droits & limites LIRI par palier — MIROIR SERVEUR de
 * apps/app/src/lib/liri/liriEntitlements.js (même sémantique, même chiffres).
 *
 * Le front affiche les limites (bandeau, gating UI) ; ICI est la BARRIÈRE réelle,
 * non contournable : le moteur live (durée / participants / lives simultanés) lit
 * ce service au mint du token et au démarrage du live. Ne jamais recoder une
 * limite ailleurs — toujours passer par resolveLimits().
 *
 * Modèle (décision produit 2026-06-24) :
 *   - GRATUIT : live 3 min / 5 pers / 1 à la fois (pas de replay/IA/programmé) ;
 *   - ESSAI (7 j) : tout débloqué, puis bascule en gratuit si non payé ;
 *   - PAYANT : grille Cimolace → tout débloqué.
 */

export type LiriTier = "paid" | "trial" | "free";

export interface LiriLimits {
  /** Durée max d'un live en minutes (null = illimité). */
  maxLiveMinutes: number | null;
  /** Participants max dans un live (null = illimité). */
  maxParticipants: number | null;
  /** Lives simultanés max pour le tenant (null = illimité). */
  maxConcurrentLives: number | null;
  canReplay: boolean;
  canSmartboardAI: boolean;
  canNeuroRecall: boolean;
  canSchedule: boolean;
}

export const LIRI_FREE_LIMITS: LiriLimits = Object.freeze({
  maxLiveMinutes: 3,
  maxParticipants: 5,
  maxConcurrentLives: 1,
  canReplay: false,
  canSmartboardAI: false,
  canNeuroRecall: false,
  canSchedule: false,
});

export const LIRI_FULL_LIMITS: LiriLimits = Object.freeze({
  maxLiveMinutes: null,
  maxParticipants: null,
  maxConcurrentLives: null,
  canReplay: true,
  canSmartboardAI: true,
  canNeuroRecall: true,
  canSchedule: true,
});

@Injectable()
export class LiriEntitlementsService {
  constructor(private auth: AuthService) {}
  private get supabase() {
    return this.auth.getClient();
  }

  /**
   * Palier LIRI effectif d'un tenant, lu depuis billing_subscriptions (source de
   * vérité). Un abonnement est « actif » s'il est status='active' ET non expiré
   * (current_period_end NULL = bootstrap/forfait sans échéance, ou > now). Le label
   * 'trial' vs 'paid' n'a aucune incidence sur les limites (les deux = tout
   * débloqué) — il sert juste à la lisibilité / aux futurs messages.
   *
   * FAIL-OPEN : si la lecture billing échoue, on renvoie 'paid'. Un client qui PAIE
   * ne doit JAMAIS voir son live coupé à 3 min à cause d'un glitch de lecture ; la
   * facturation se régularise à froid. La fuite (un gratuit non bridé sur un glitch)
   * est marginale et acceptable face au risque de churn d'un payant.
   */
  async resolveTier(tenantId: string): Promise<LiriTier> {
    try {
      // On lit les N dernières lignes et on cherche le dernier abonnement
      // EXPLOITABLE — PAS seulement la dernière ligne : un checkout abandonné
      // (status 'pending' plus récent que l'abo actif) rétrogradait à tort le
      // tenant en 'free' (bug constaté sur isna le 2026-07-05 : 2 abos actifs
      // masqués par un pending).
      const { data, error } = await this.supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, plan_id, metadata")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return "paid"; // fail-open
      const rows = (Array.isArray(data) ? data : []) as Array<{
        status?: string;
        current_period_end?: string | null;
        plan_id?: string | null;
        metadata?: Record<string, unknown> | null;
      }>;
      if (!rows.length) return "free"; // aucun abonnement → gratuit
      const now = Date.now();
      const sub = rows.find((s) => {
        const end = s.current_period_end
          ? new Date(s.current_period_end).getTime()
          : null;
        return s.status === "active" && (end === null || end > now);
      });
      if (!sub) return "free";
      const isTrial =
        (sub.metadata as { trial?: boolean } | null)?.trial === true ||
        String(sub.plan_id ?? "").includes("trial");
      return isTrial ? "trial" : "paid";
    } catch {
      return "paid"; // fail-open
    }
  }

  limitsFor(tier: LiriTier): LiriLimits {
    return tier === "free" ? LIRI_FREE_LIMITS : LIRI_FULL_LIMITS;
  }

  /** Raccourci : palier + limites effectives d'un tenant. */
  async resolveLimits(
    tenantId: string,
  ): Promise<{ tier: LiriTier; limits: LiriLimits }> {
    const tier = await this.resolveTier(tenantId);
    return { tier, limits: this.limitsFor(tier) };
  }

  // ─── P6 — PLAFONDS PAR OFFRE (billing_plans.features) ───────────────────────
  // Les plans (surtout LOCAUX) portent des caps durs dans features : patients,
  // students, clients, teleconsults_month, live_hours_month, vod_gb, catalog_size,
  // seats… Ces méthodes lisent le cap du plan ACTIF et le font respecter aux points
  // de création. Branchement type (ex. MEDOS createPatient) :
  //   const n = await countPatients(tenantId);
  //   await entitlements.assertWithinCap(tenantId, 'patients', n);   // 403 si atteint

  /** Caps du plan ACTIF d'un tenant (billing_plans.features). {} si aucun/illimité. */
  async resolvePlanFeatures(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await this.supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, plan_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      const now = Date.now();
      const active = (Array.isArray(data) ? data : []).find(
        (s: { status?: string; current_period_end?: string | null }) =>
          s.status === "active" &&
          (!s.current_period_end || new Date(s.current_period_end).getTime() > now),
      ) as { plan_id?: string | null } | undefined;
      if (!active?.plan_id) return {};
      const { data: plan } = await this.supabase
        .from("billing_plans").select("features").eq("key", active.plan_id).maybeSingle();
      return ((plan as { features?: Record<string, unknown> } | null)?.features ?? {}) as Record<string, unknown>;
    } catch {
      return {}; // fail-open : pas de blocage sur glitch de lecture
    }
  }

  /**
   * Barrière de plafond : lève 403 si l'usage courant ATTEINT le cap du plan.
   * Cap absent/non numérique = illimité (autorisé — les plans premium n'ont pas de cap).
   * Lecture en échec = autorisé (fail-open : ne jamais bloquer un payant sur un glitch ;
   * la fuite marginale est préférable au churn d'un client légitime).
   */
  async assertWithinCap(tenantId: string, capKey: string, currentCount: number): Promise<void> {
    const features = await this.resolvePlanFeatures(tenantId);
    const cap = capBreached(features, capKey, currentCount);
    if (cap === null) return;
    // GRANDFATHERING : le plafond n'est appliqué QUE si le tenant a opté (enforce_caps).
    // Défaut OFF → aucun client existant n'est jamais bloqué, quels que soient les caps
    // définis sur les plans. Les nouveaux tenants achetés reçoivent enforce_caps=true
    // (createTenantFromPurchase → insertTenantForPurchase).
    if (!(await this.capsEnforced(tenantId))) return;
    throw new ForbiddenException(
      `Limite de votre offre atteinte (${capKey} : ${cap}). Passez à l'offre supérieure pour augmenter ce plafond.`,
    );
  }

  /**
   * Opt-in d'application des plafonds : `tenants.metadata.billing.enforce_caps === true`.
   * Défaut false = grandfather (jamais de blocage). Lecture en échec = false (fail-open).
   */
  private async capsEnforced(tenantId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from("tenants").select("metadata").eq("id", tenantId).maybeSingle();
      const m = (data as { metadata?: Record<string, unknown> } | null)?.metadata as
        | { billing?: { enforce_caps?: boolean } }
        | undefined;
      return m?.billing?.enforce_caps === true;
    } catch {
      return false;
    }
  }
}

/**
 * DÉCISION PURE (testable) du plafond : renvoie le cap dépassé (nombre) si `currentCount`
 * l'ATTEINT, sinon null (autorisé). Cap absent/non numérique = illimité (null). Le `>=`
 * bloque la Nᵉ création quand le cap = N-1 déjà atteint (ex. cap 80, 80 existants → le 81ᵉ bloqué).
 */
export function capBreached(
  features: Record<string, unknown> | null | undefined,
  capKey: string,
  currentCount: number,
): number | null {
  const cap = features?.[capKey];
  if (typeof cap === "number" && Number.isFinite(cap) && currentCount >= cap) return cap;
  return null;
}
