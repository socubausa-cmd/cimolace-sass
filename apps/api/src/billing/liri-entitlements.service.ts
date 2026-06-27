import { Injectable } from "@nestjs/common";
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
      const { data, error } = await this.supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, plan_id, metadata")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return "paid"; // fail-open
      if (!data) return "free"; // aucun abonnement → gratuit
      const sub = data as {
        status?: string;
        current_period_end?: string | null;
        plan_id?: string | null;
        metadata?: Record<string, unknown> | null;
      };
      const now = Date.now();
      const end = sub.current_period_end
        ? new Date(sub.current_period_end).getTime()
        : null;
      const active = sub.status === "active" && (end === null || end > now);
      if (!active) return "free";
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
}
