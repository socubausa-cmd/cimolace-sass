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

  async handleWebhook(payload: Buffer, signature: string) {
    // Stripe webhook handler stub
    console.log("Webhook received", { sig: signature?.slice(0, 10), len: payload.length });
    return { received: true };
  }
}
