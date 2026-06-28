import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { TenantPaymentConfigService } from "../billing/tenant-payment-config/tenant-payment-config.service";
import {
  isStripeConfigured,
  stripeCreateCheckoutSession,
  verifyStripeSignature,
} from "../billing/stripe-rest.util";

/**
 * Vente d'un LIVE payant (Couche B : le TENANT encaisse SES clients).
 *
 * - createSession : crée une session Stripe Checkout scopée au tenant (sa PROPRE
 *   clé Stripe si configurée via TenantPaymentConfigService, sinon clé plateforme),
 *   au prix du live (`live_sessions.price_cents`). Renvoie { checkoutUrl }.
 * - handleStripeWebhook : à la confirmation (checkout.session.completed), pose un
 *   `access_passes` actif (resource_type='live_session') → le gate de
 *   LiveService.generateToken laisse alors entrer l'acheteur. Idempotent.
 *
 * Remplace l'ancien placeholder (URL Stripe factice / webhook no-op).
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly tenantPayments: TenantPaymentConfigService,
  ) {}

  /** Client Supabase service-role (cast any : plusieurs tables hors types générés). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.auth.getClient();
  }

  /**
   * Crée une session Stripe Checkout (carte) pour rejoindre un live PAYANT.
   * Clé Stripe DU TENANT si configurée, sinon clé plateforme (env). JWT requis.
   */
  async createSession(userId: string, liveSessionId: string) {
    const { data: live } = await this.db
      .from("live_sessions")
      .select("id, tenant_id, price_cents, currency, title, status")
      .eq("id", liveSessionId)
      .maybeSingle();
    if (!live) throw new NotFoundException("Live introuvable.");

    const priceCents = Number(live.price_cents ?? 0);
    if (!(priceCents > 0)) {
      throw new BadRequestException("Ce live est gratuit — aucun paiement requis.");
    }
    const tenantId = live.tenant_id as string;

    // Déjà un accès actif → inutile de repayer.
    const { data: existing } = await this.db
      .from("access_passes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("resource_type", "live_session")
      .eq("resource_id", liveSessionId)
      .eq("status", "active")
      .maybeSingle();
    if (existing?.id) {
      throw new BadRequestException("Vous avez déjà accès à ce live.");
    }

    // Clé Stripe DU TENANT (si configurée + enabled) — sinon env plateforme.
    // resolveTenantProviderCreds ne lève jamais : pas de config → fallback transparent.
    const tenantStripe = await this.tenantPayments.resolveTenantProviderCreds(
      tenantId,
      "stripe",
    );
    const tenantStripeKey = tenantStripe?.creds?.secret_key || null;
    if (!tenantStripeKey && !isStripeConfigured()) {
      throw new ServiceUnavailableException(
        "Paiement carte indisponible : aucune clé Stripe (ni tenant, ni plateforme).",
      );
    }

    const currency = String(live.currency || "EUR").toLowerCase();
    const productName = String(live.title || "Accès au live").slice(0, 120);
    const fallbackBase = process.env.SCHOOL_FRONTEND_URL ?? "https://liri.cimolace.space";
    const successUrl = `${fallbackBase}/lives/${liveSessionId}/join?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${fallbackBase}/lives/${liveSessionId}/join?payment=cancel`;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price_data][currency]", currency);
    params.append("line_items[0][price_data][unit_amount]", String(priceCents));
    params.append("line_items[0][price_data][product_data][name]", productName);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("client_reference_id", userId);
    // metadata exploitées par le webhook pour poser l'access_pass.
    params.append("metadata[kind]", "live_session");
    params.append("metadata[user_id]", userId);
    params.append("metadata[tenant_id]", tenantId);
    params.append("metadata[live_session_id]", liveSessionId);

    let session: { id: string; url: string };
    try {
      // Clé tenant si présente, sinon undefined → l'util retombe sur STRIPE_SECRET_KEY (env).
      session = await stripeCreateCheckoutSession(params, tenantStripeKey ?? undefined);
    } catch (e) {
      this.logger.error("Stripe createCheckoutSession (live)", (e as Error).message);
      throw new ServiceUnavailableException(
        `Impossible de créer la session de paiement : ${(e as Error).message}`,
      );
    }

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  /**
   * Webhook Stripe du live payant — pas de JWT, protégé par signature `stripe-signature`.
   * rawBody activé globalement (main.ts). Sur paiement confirmé d'un live (kind=live_session),
   * pose un access_pass actif (idempotent) + rattache l'acheteur au tenant en role 'student'
   * (sans JAMAIS rétrograder un membre existant). À enregistrer dans Stripe :
   * POST /checkout/webhook/stripe (event checkout.session.completed).
   */
  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    // Secret de vérif PAR TENANT (multi-tenant : chaque tenant peut avoir son propre
    // compte Stripe + son propre webhook secret). On « peek » le tenant_id du payload
    // NON vérifié UNIQUEMENT pour choisir le bon secret ; la confiance vient ENSUITE de
    // la signature (un tenant_id forgé → aucun secret candidat ne valide → 400). Repli
    // sur les secrets d'env (compte Stripe plateforme).
    let peekTenantId: string | null = null;
    try {
      const peek = JSON.parse((rawBody ?? Buffer.alloc(0)).toString("utf8"));
      peekTenantId = peek?.data?.object?.metadata?.tenant_id ?? null;
    } catch {
      /* payload illisible → on tentera les secrets d'env */
    }

    const candidates: string[] = [];
    if (peekTenantId) {
      const tp = await this.tenantPayments.resolveTenantProviderCreds(peekTenantId, "stripe");
      if (tp?.creds?.webhook_secret) candidates.push(tp.creds.webhook_secret);
    }
    for (const s of [
      process.env.STRIPE_LIVE_WEBHOOK_SECRET,
      process.env.STRIPE_WEBHOOK_SECRET,
      process.env.STRIPE_BILLING_WEBHOOK_SECRET,
    ]) {
      if (s) candidates.push(s);
    }
    if (candidates.length === 0) {
      this.logger.warn("Webhook Stripe live : aucun secret (tenant ni env) — ignoré.");
      return { received: true };
    }

    let event: any = null;
    for (const secret of candidates) {
      event = verifyStripeSignature(rawBody ?? Buffer.alloc(0), signature, secret);
      if (event) break;
    }
    if (!event) throw new BadRequestException("Signature Stripe invalide.");

    const paidTypes = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ]);
    if (paidTypes.has(event.type)) {
      const s = event.data?.object ?? {};
      const meta = s.metadata ?? {};
      const isPaid =
        event.type === "checkout.session.async_payment_succeeded" ||
        s.payment_status === "paid";
      if (
        meta.kind === "live_session" &&
        meta.user_id &&
        meta.tenant_id &&
        meta.live_session_id &&
        isPaid
      ) {
        await this.db.from("access_passes").upsert(
          {
            tenant_id: meta.tenant_id,
            user_id: meta.user_id,
            resource_type: "live_session",
            resource_id: meta.live_session_id,
            payment_id: s.payment_intent ?? s.id ?? null,
            status: "active",
          },
          { onConflict: "tenant_id,user_id,resource_type,resource_id" },
        );
        // Rattachement au tenant (role student) — ignoreDuplicates : ne rétrograde
        // JAMAIS un owner/teacher existant, accorde juste l'accès aux non-membres.
        await this.db.from("tenant_memberships").upsert(
          {
            tenant_id: meta.tenant_id,
            user_id: meta.user_id,
            role: "student",
            status: "active",
          },
          { onConflict: "tenant_id,user_id", ignoreDuplicates: true },
        );
        this.logger.log(
          `Live payant : accès accordé user=${meta.user_id} live=${meta.live_session_id}`,
        );
      }
    }
    return { received: true };
  }
}
