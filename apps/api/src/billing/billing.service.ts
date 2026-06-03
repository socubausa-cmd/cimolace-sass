import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuthService } from "../auth/auth.service";
import { PawaPayService } from "../pawapay/pawapay.service";

@Injectable()
export class BillingService {
  constructor(private auth: AuthService, private pawapay: PawaPayService) {}
  private get supabase() { return this.auth.getClient(); }

  async getSubscription(tenantId: string) {
    const { data } = await this.supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).single();
    return data;
  }
  async createSubscription(tenantId: string, plan: string, provider: string) {
    const { data } = await this.supabase.from("subscriptions").insert({ tenant_id: tenantId, plan, provider, status: "active" }).select().single();
    return data;
  }
  async getInvoices(tenantId: string) {
    const { data } = await this.supabase.from("invoices").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return data ?? [];
  }

  // ─── Abonnement plateforme (billing_*) : état + collecte mobile money ──────
  async getTenantSubscription(tenantId: string) {
    const { data: subs } = await this.supabase
      .from("billing_subscriptions").select("*")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false });
    const { data: invoices } = await this.supabase
      .from("billing_invoices").select("*")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return { subscriptions: subs ?? [], invoices: invoices ?? [] };
  }

  /**
   * Initie une collecte PawaPay (mobile money) pour régler la facture en cours
   * d'un abonnement. Le montant est lu en base (jamais fourni par le client).
   * Nécessite PAWAPAY_API_TOKEN configuré ; sinon le service mobile money est
   * désactivé et renvoie une erreur explicite.
   */
  async collectSubscriptionViaPawaPay(
    tenantId: string,
    subscriptionId: string,
    dto: { phoneNumber?: string; provider?: string; country?: string },
  ) {
    if (!dto?.phoneNumber || !dto?.provider) {
      throw new BadRequestException("phoneNumber et provider (opérateur mobile money, ex: MTN_MOMO_CMR) requis");
    }
    const sb = this.supabase;
    const { data: sub } = await sb.from("billing_subscriptions")
      .select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
    if (!sub) throw new NotFoundException("Abonnement introuvable");

    const { data: invoices } = await sb.from("billing_invoices")
      .select("*").eq("subscription_id", subscriptionId)
      .in("status", ["pending", "processing", "failed"])
      .order("created_at", { ascending: false }).limit(1);
    const invoice = (invoices ?? [])[0];
    if (!invoice) throw new NotFoundException("Aucune facture à régler pour cet abonnement");

    const depositId = randomUUID();
    // Devises PawaPay (XAF/XOF/…) sans décimale → le montant entier stocké est
    // directement la valeur en unité majeure.
    const init = await this.pawapay.initiateDeposit({
      depositId,
      amount: String(invoice.amount_cents),
      currency: invoice.currency,
      payer: { type: "MMO", accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.provider } },
      statementDescription: "MEDOS Cimolace",
      metadata: {
        tenant: tenantId,
        invoice: String(invoice.invoice_number ?? invoice.id),
        subscription: subscriptionId,
      },
    });

    await sb.from("billing_invoices").update({
      provider: "pawapay",
      status: "processing",
      provider_transaction_id: depositId,
      metadata: { ...(invoice.metadata ?? {}), pawapay_deposit_id: depositId, payer_phone: dto.phoneNumber, payer_provider: dto.provider },
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);

    return {
      deposit_id: depositId,
      status: init.status,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount_cents,
      currency: invoice.currency,
    };
  }

  /**
   * Applique un callback PawaPay : marque la facture payée (et prolonge
   * l'abonnement) si COMPLETED, échouée si FAILED/REJECTED. Idempotent.
   */
  async applyPawaPayDeposit(cb: { depositId?: string; status?: string; failureReason?: unknown }) {
    if (!cb?.depositId) return { received: true, matched: false };
    const sb = this.supabase;
    const { data: inv } = await sb.from("billing_invoices")
      .select("*").eq("provider_transaction_id", cb.depositId).maybeSingle();
    if (!inv) return { received: true, matched: false };

    if (cb.status === "COMPLETED") {
      await sb.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", inv.id);
      if (inv.subscription_id) {
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await sb.from("billing_subscriptions").update({ status: "active", current_period_end: end.toISOString(), updated_at: new Date().toISOString() }).eq("id", inv.subscription_id);
      }
      return { received: true, matched: true, status: "paid" };
    }
    if (cb.status === "FAILED" || cb.status === "REJECTED") {
      await sb.from("billing_invoices").update({ status: "failed", metadata: { ...(inv.metadata ?? {}), failure: cb.failureReason ?? null }, updated_at: new Date().toISOString() }).eq("id", inv.id);
      return { received: true, matched: true, status: "failed" };
    }
    return { received: true, matched: true, status: cb.status };
  }

  // ─── Paiement carte (Stripe) — pour les clients hors mobile money (Europe) ─
  private stripeAuth() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new BadRequestException("Paiement carte indisponible (STRIPE_SECRET_KEY non configurée)");
    return `Basic ${Buffer.from(secret + ":").toString("base64")}`;
  }

  /**
   * Crée une session Stripe Checkout (abonnement récurrent par carte) pour un
   * abonnement plateforme. Renvoie l'URL hébergée. Le prix vient du plan
   * (billing_plans.stripe_price_id), jamais du client.
   */
  async createCardCheckout(tenantId: string, subscriptionId: string) {
    const auth = this.stripeAuth();
    const sb = this.supabase;
    const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
    if (!sub) throw new NotFoundException("Abonnement introuvable");
    const { data: plan } = await sb.from("billing_plans").select("stripe_price_id, label").eq("key", (sub as any).plan_id).maybeSingle();
    const priceId = (plan as any)?.stripe_price_id;
    if (!priceId) throw new BadRequestException("Aucun prix Stripe configuré pour ce plan (carte indisponible)");

    const frontend = process.env.FRONTEND_URL || "https://cimolace.space";
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${frontend}/dashboard/billing?card=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${frontend}/dashboard/billing?card=cancel`);
    params.append("client_reference_id", subscriptionId);
    params.append("metadata[tenant_id]", tenantId);
    params.append("metadata[subscription_id]", subscriptionId);
    if ((sub as any).customer_email) params.append("customer_email", (sub as any).customer_email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new BadRequestException(`Stripe Checkout error ${res.status}: ${t.slice(0, 300)}`);
    }
    const session = (await res.json()) as { id: string; url: string };
    await sb.from("billing_subscriptions").update({ provider: "stripe", provider_checkout_id: session.id, updated_at: new Date().toISOString() }).eq("id", subscriptionId);
    return { url: session.url, session_id: session.id, amount_cents: (sub as any).amount_cents, currency: (sub as any).currency };
  }

  /**
   * Confirmation au retour : interroge Stripe pour l'état de la session carte ;
   * si payée, bascule la facture en payée + prolonge l'abonnement. Idempotent.
   */
  async confirmCardPayment(tenantId: string, subscriptionId: string) {
    const auth = this.stripeAuth();
    const sb = this.supabase;
    const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
    if (!sub) throw new NotFoundException("Abonnement introuvable");
    const sessionId = (sub as any).provider_checkout_id;
    if (!sessionId) return { paid: false, status: (sub as any).status };

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new BadRequestException(`Stripe session lookup ${res.status}`);
    const s = (await res.json()) as { payment_status?: string; status?: string; subscription?: string; customer?: string };
    const paid = s.payment_status === "paid" || s.status === "complete";
    if (paid) {
      const end = new Date(); end.setMonth(end.getMonth() + 1);
      await sb.from("billing_subscriptions").update({ status: "active", provider_subscription_id: s.subscription ?? null, provider_customer_id: s.customer ?? null, current_period_end: end.toISOString(), updated_at: new Date().toISOString() }).eq("id", subscriptionId);
      await sb.from("billing_invoices").update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("subscription_id", subscriptionId).in("status", ["pending", "processing", "failed"]);
    }
    return { paid, status: paid ? "active" : (sub as any).status };
  }

  // ─── Retraits / versements mobile money (payouts PawaPay) ─────────────────
  private static ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV"]);

  /**
   * Initie un retrait : ENVOIE de l'argent sur un mobile money (marchand,
   * remboursement, reversement…). Le montant est en unité majeure pour les
   * devises sans décimale (XAF). Enregistre le payout puis appelle PawaPay.
   */
  async createPayout(
    tenantId: string,
    createdBy: string | null,
    dto: { amountCents?: number; currency?: string; phoneNumber?: string; mno?: string; recipientName?: string; reason?: string },
  ) {
    const amountCents = Math.round(Number(dto?.amountCents) || 0);
    if (amountCents <= 0) throw new BadRequestException("amountCents (> 0) requis");
    if (!dto?.phoneNumber || !dto?.mno) throw new BadRequestException("phoneNumber et mno (opérateur, ex: MTN_MOMO_CMR) requis");
    const currency = (dto.currency || "XAF").toUpperCase();
    const sb = this.supabase;
    const payoutId = randomUUID();

    // 1) tracer d'abord (même si l'appel PawaPay échoue ensuite)
    await sb.from("billing_payouts").insert({
      tenant_id: tenantId, payout_id: payoutId, provider: "pawapay", status: "pending",
      amount_cents: amountCents, currency, phone_number: dto.phoneNumber, mno: dto.mno,
      recipient_name: dto.recipientName ?? null, reason: dto.reason ?? null, created_by: createdBy,
    });

    // 2) montant string : XAF & co sans décimale → valeur entière directe
    const amount = BillingService.ZERO_DECIMAL.has(currency) ? String(amountCents) : (amountCents / 100).toFixed(2);
    let initStatus = "pending";
    try {
      const init = await this.pawapay.initiatePayout({
        payoutId, amount, currency,
        recipient: { type: "MMO", accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.mno } },
        customerMessage: (dto.reason ?? "Cimolace payout").slice(0, 22),
        metadata: { tenant: tenantId },
      });
      initStatus = (init.status || "ACCEPTED").toLowerCase();
      await sb.from("billing_payouts").update({ status: initStatus, updated_at: new Date().toISOString() }).eq("payout_id", payoutId);
    } catch (e) {
      await sb.from("billing_payouts").update({ status: "failed", failure_message: (e as Error).message, updated_at: new Date().toISOString() }).eq("payout_id", payoutId);
      throw e;
    }
    return { payout_id: payoutId, status: initStatus, amount_cents: amountCents, currency };
  }

  async listPayouts(tenantId: string) {
    const { data } = await this.supabase.from("billing_payouts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return data ?? [];
  }

  /** Callback PawaPay payout : met à jour le statut du retrait. */
  async applyPayoutCallback(cb: { payoutId?: string; status?: string; providerTransactionId?: string; failureReason?: { failureCode?: string; failureMessage?: string } }) {
    if (!cb?.payoutId) return { received: true, matched: false };
    const sb = this.supabase;
    const { data: row } = await sb.from("billing_payouts").select("id").eq("payout_id", cb.payoutId).maybeSingle();
    if (!row) return { received: true, matched: false };
    const status = (cb.status || "").toUpperCase();
    const mapped = status === "COMPLETED" ? "completed" : (status === "FAILED" || status === "REJECTED") ? "failed" : status.toLowerCase() || "pending";
    await sb.from("billing_payouts").update({
      status: mapped, provider_tx_id: cb.providerTransactionId ?? null,
      failure_code: cb.failureReason?.failureCode ?? null, failure_message: cb.failureReason?.failureMessage ?? null,
      updated_at: new Date().toISOString(),
    }).eq("payout_id", cb.payoutId);
    return { received: true, matched: true, status: mapped };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    // Stripe webhook handler stub
    console.log("Webhook received", { sig: signature?.slice(0, 10), len: payload.length });
    return { received: true };
  }
}
