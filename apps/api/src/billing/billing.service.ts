import { Injectable, BadRequestException, NotFoundException, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { AuthService } from "../auth/auth.service";
import { PawaPayService } from "../pawapay/pawapay.service";
import { WebhookService } from "../liri-public/webhook.service";
import { EmailEngineService } from "../email-engine/email-engine.service";
import { resolvePlanServices } from "./plan-services";

@Injectable()
export class BillingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private auth: AuthService,
    private pawapay: PawaPayService,
    private tenantWebhooks: WebhookService,
    private email: EmailEngineService,
  ) {}
  private get supabase() { return this.auth.getClient(); }

  // Cron INTERNE léger (sans @nestjs/schedule) : renouvellement mobile money
  // quotidien (push-to-approve). renewDueSubscriptions est idempotent (anti
  // double-relance) → sûr même si relancé. Complète l'endpoint /billing/renewals/run.
  onApplicationBootstrap() {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const run = () =>
      this.renewDueSubscriptions()
        .then((r) => {
          if (r.initiated) this.logger.log(`Renouvellements relancés: ${r.initiated}/${r.scanned}`);
        })
        .catch((e) => this.logger.warn(`renewDueSubscriptions: ${(e as Error).message}`));
    // 1er passage 60 s après le boot, puis toutes les 24 h.
    setTimeout(() => { void run(); setInterval(() => void run(), DAY_MS); }, 60_000);
  }

  /**
   * Notifie les endpoints webhook du tenant (tenant_webhooks, HMAC
   * X-Cimolace-Signature). Fire-and-forget : ne bloque jamais le traitement
   * du webhook Stripe entrant.
   */
  private notifyTenant(tenantId: string | null | undefined, event: any, data: Record<string, unknown>) {
    if (!tenantId) return;
    this.tenantWebhooks
      .emit(tenantId, event, data)
      .catch((e) => console.warn(`[billing webhook] émission tenant_webhooks échouée: ${(e as Error).message}`));
  }

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
   * Active (depuis le back-office Cimolace) un abonnement plateforme forfaitaire
   * pour un tenant, à partir du catalogue Cimolace (`billing_plans`), et **arme le
   * gating** de la clé tenant (`metadata.billing.api_gating = true`). Le produit
   * est défini chez nous (pas dans Stripe) ; Stripe ne sert qu'à encaisser ensuite.
   * Idempotent : ne recrée pas si un abonnement actif existe déjà.
   * `current_period_end = null` = actif sans échéance (bootstrap) jusqu'à ce que
   * le paiement Stripe prenne le relais et pose les vraies dates de période.
   */
  async activateTenantSubscription(tenantId: string, planKey = "zahir-forfait") {
    const sb = this.supabase;
    const { data: plan } = await sb
      .from("billing_plans")
      .select("key, label, price_cents, currency")
      .eq("key", planKey)
      .maybeSingle();
    if (!plan) throw new NotFoundException(`Plan "${planKey}" introuvable dans billing_plans`);

    const { data: existing } = await sb
      .from("billing_subscriptions")
      .select("id, status, plan_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    let subscription = existing;
    if (!existing) {
      const { data: created, error } = await sb
        .from("billing_subscriptions")
        .insert({
          tenant_id: tenantId,
          plan_id: (plan as any).key,
          provider: "stripe",
          status: "active",
          amount_cents: (plan as any).price_cents ?? 0,
          currency: (plan as any).currency ?? "EUR",
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          metadata: { activated_from: "backoffice", forfait: true },
        })
        .select()
        .single();
      if (error) throw new BadRequestException(`Création abonnement impossible: ${error.message}`);
      subscription = created;
    }

    // Armer le gating de la clé tenant (deep-merge metadata, préserve le reste)
    const { data: t } = await sb.from("tenants").select("metadata").eq("id", tenantId).maybeSingle();
    const meta = ((t as any)?.metadata as Record<string, any>) ?? {};
    const merged = { ...meta, billing: { ...(meta.billing ?? {}), api_gating: true } };
    await sb
      .from("tenants")
      .update({ metadata: merged, updated_at: new Date().toISOString() })
      .eq("id", tenantId);

    // Provisioning produit : activer les moteurs du plan (parité avec le paiement).
    await this.provisionPlanServices(tenantId, (plan as any).key);

    return { subscription, gating_enabled: true, plan: (plan as any).key };
  }

  /** Providers de paiement autorisés (= CHECK billing_subscriptions/invoices provider). */
  private static readonly PAYMENT_PROVIDERS = new Set([
    "stripe", "chariow", "cinetpay", "pawapay", "nowpayments", "paypal", "free",
  ]);

  /**
   * SELF-SERVE upgrade : crée (ou réutilise) un abonnement EN ATTENTE pour le plan
   * choisi (billing_plans) + une facture à régler, que le tenant paie ensuite via
   * `createCardCheckout` (Stripe, prix INLINE depuis price_cents) ou
   * `collectSubscriptionViaPawaPay` (mobile money). À la confirmation du paiement,
   * la même plomberie existante flippe l'abo en 'active' + provisionne les moteurs
   * (confirmCardPayment / applyPawaPayDeposit). C'est le maillon « je choisis un
   * forfait » qui manquait entre la grille et le paiement.
   *
   * NB : le palier LIRI ([[liri-entitlements]]) lit `current_period_end` ; un abo
   * 'pending' (period_end NULL) reste donc en GRATUIT tant que le paiement n'a pas
   * abouti — l'upgrade ne débloque rien avant d'être payé.
   */
  async subscribeToPlan(
    tenantId: string,
    planKey: string,
    provider = "stripe",
  ) {
    if (!planKey) throw new BadRequestException("planKey requis");
    const prov = String(provider || "stripe").toLowerCase();
    if (!BillingService.PAYMENT_PROVIDERS.has(prov)) {
      throw new BadRequestException(`provider invalide (autorisés: ${[...BillingService.PAYMENT_PROVIDERS].join(", ")})`);
    }
    const sb = this.supabase;
    const { data: plan } = await sb
      .from("billing_plans")
      .select("key, label, price_cents, currency, is_active, metadata")
      .eq("key", planKey)
      .maybeSingle();
    if (!plan || (plan as any).is_active === false) {
      throw new NotFoundException(`Plan "${planKey}" introuvable ou inactif`);
    }
    // Devise selon le moyen de paiement : PawaPay (mobile money Afrique) collecte en
    // XAF/XOF (sans décimale) → prix DÉDIÉ lu dans metadata.price_xaf (montant entier,
    // ex. 3000 = 3000 XAF). Stripe (carte) garde le prix EUR inline (price_cents).
    const meta = ((plan as any).metadata ?? {}) as Record<string, any>;
    let amountCents: number;
    let currency: string;
    if (prov === "pawapay") {
      amountCents = Number(meta.price_xaf ?? 0);
      currency = String(meta.price_xaf_currency ?? "XAF");
      if (!amountCents) {
        throw new BadRequestException(
          `Paiement mobile money indisponible pour "${planKey}" : prix XAF non configuré (billing_plans.metadata.price_xaf).`,
        );
      }
    } else {
      amountCents = Number((plan as any).price_cents ?? 0);
      currency = String((plan as any).currency ?? "EUR");
    }

    // Réutilise un abo EN ATTENTE existant pour ce plan (évite d'empiler les pending).
    const { data: existing } = await sb
      .from("billing_subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("plan_id", planKey)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    let subscriptionId = (existing as any)?.id as string | undefined;
    if (subscriptionId) {
      await sb.from("billing_subscriptions")
        .update({ provider: prov, amount_cents: amountCents, currency, updated_at: new Date().toISOString() })
        .eq("id", subscriptionId);
    } else {
      const { data: created, error } = await sb
        .from("billing_subscriptions")
        .insert({
          tenant_id: tenantId,
          plan_id: planKey,
          provider: prov,
          status: "pending",
          amount_cents: amountCents,
          currency,
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          metadata: { source: "self-serve-upgrade", plan_label: (plan as any).label },
        })
        .select("id")
        .single();
      if (error || !created) {
        throw new BadRequestException(`Création abonnement impossible: ${error?.message ?? "inconnue"}`);
      }
      subscriptionId = (created as any).id as string;
    }

    // Facture à régler (requise par le flux PawaPay ; inoffensive pour le flux carte).
    const { data: openInv } = await sb
      .from("billing_invoices")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .in("status", ["pending", "processing", "failed"])
      .limit(1)
      .maybeSingle();
    let invoiceId = (openInv as any)?.id as string | undefined;
    if (!invoiceId) {
      const { data: inv } = await sb
        .from("billing_invoices")
        .insert({
          tenant_id: tenantId,
          subscription_id: subscriptionId,
          provider: prov,
          status: "pending",
          amount_cents: amountCents,
          currency,
          invoice_number: `LIRI-${Date.now().toString(36).toUpperCase()}`,
          description: `Abonnement ${(plan as any).label ?? planKey}`,
        })
        .select("id")
        .maybeSingle();
      invoiceId = (inv as any)?.id;
    }

    return {
      subscription_id: subscriptionId,
      invoice_id: invoiceId ?? null,
      plan: { key: planKey, label: (plan as any).label, price_cents: amountCents, currency },
      status: "pending",
    };
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
      // PawaPay v2 : MSISDN en chiffres SEULS (pas de "+"), ex. "24177514015".
      payer: { type: "MMO", accountDetails: { phoneNumber: String(dto.phoneNumber).replace(/[^0-9]/g, ""), provider: dto.provider } },
      clientReferenceId: String(invoice.invoice_number ?? invoice.id),
      customerMessage: "Cimolace LIRI",
      // PawaPay v2 : metadata = TABLEAU d'objets À UNE CLÉ (la clé = nom du champ, unique).
      // ⚠️ PAS { fieldName, fieldValue } → PawaPay verrait « fieldValue » dupliqué (DUPLICATE_METADATA_FIELD).
      metadata: [
        { tenant: tenantId },
        { invoice: String(invoice.invoice_number ?? invoice.id) },
        { subscription: subscriptionId },
      ],
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
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        // Moyen de paiement : le numéro/opérateur utilisé (stocké sur la facture au moment du collect).
        const payMethod = (inv.metadata as any)?.payer_phone
          ? { type: "mobile_money", provider: (inv.metadata as any).payer_provider ?? null, phone: (inv.metadata as any).payer_phone }
          : null;
        const { data: subRow } = await sb.from("billing_subscriptions").select("metadata, user_id, tenant_id").eq("id", inv.subscription_id).maybeSingle();
        await sb.from("billing_subscriptions").update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          metadata: { ...((subRow as any)?.metadata ?? {}), ...(payMethod ? { payment_method: payMethod } : {}) },
          updated_at: new Date().toISOString(),
        }).eq("id", inv.subscription_id);
        // Reçu email de confirmation (best-effort ; no-op silencieux si Resend non configuré).
        void this.sendPaymentReceiptEmail(inv, subRow, payMethod, end);
      }
      return { received: true, matched: true, status: "paid" };
    }
    if (cb.status === "FAILED" || cb.status === "REJECTED") {
      await sb.from("billing_invoices").update({ status: "failed", metadata: { ...(inv.metadata ?? {}), failure: cb.failureReason ?? null }, updated_at: new Date().toISOString() }).eq("id", inv.id);
      return { received: true, matched: true, status: "failed" };
    }
    return { received: true, matched: true, status: cb.status };
  }

  /** Envoie un reçu de paiement par email (best-effort, silencieux si Resend absent). */
  private async sendPaymentReceiptEmail(inv: any, sub: any, payMethod: any, periodEnd: Date) {
    try {
      const userId = sub?.user_id;
      const tenantId = sub?.tenant_id ?? inv?.tenant_id;
      if (!userId || !tenantId) return;
      const { data: userRes } = await (this.supabase as any).auth.admin.getUserById(userId);
      const to = userRes?.user?.email;
      if (!to) return;
      const cur = String(inv.currency ?? "").toUpperCase();
      const amount = BillingService.ZERO_DECIMAL.has(cur)
        ? `${inv.amount_cents} ${cur}`
        : `${(inv.amount_cents / 100).toFixed(2)} ${cur}`;
      const echeance = periodEnd.toISOString().slice(0, 10);
      const pm = payMethod
        ? `Mobile Money${payMethod.provider ? ` (${payMethod.provider})` : ""} ${payMethod.phone}`
        : "—";
      const html = this.email.brandedHtml({
        title: "Paiement confirmé",
        body: `Merci ! Votre paiement de <strong>${amount}</strong> a bien été reçu.<br/><br/>
          Facture : <strong>${inv.invoice_number ?? inv.id}</strong><br/>
          Moyen de paiement : ${pm}<br/>
          Abonnement actif jusqu'au : <strong>${echeance}</strong>`,
        brand: "#d97757",
      });
      await this.email.sendRaw(tenantId, to, "Votre reçu de paiement — Cimolace LIRI", html);
    } catch {
      /* best-effort : ne jamais casser l'activation pour un email */
    }
  }

  /**
   * Polling PawaPay. Le compte PawaPay étant partagé (le webhook global pointe
   * ailleurs), cimolace interroge LUI-MÊME le statut de chaque dépôt mobile
   * money « en cours » du tenant et applique le résultat (COMPLETED → abo actif)
   * via applyPawaPayDeposit. Appelé par le front après « Demande envoyée ».
   */
  async syncPendingPawaPayDeposits(tenantId: string) {
    const sb = this.supabase;
    const { data: subs } = await sb
      .from("billing_subscriptions")
      .select("id")
      .eq("tenant_id", tenantId);
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (!subIds.length) return { synced: [], activated: false, failed: false };

    const { data: invoices } = await sb
      .from("billing_invoices")
      .select("id, provider_transaction_id, subscription_id, status")
      .in("subscription_id", subIds)
      .eq("provider", "pawapay")
      .in("status", ["processing", "pending"])
      .not("provider_transaction_id", "is", null);

    const synced: Array<{
      depositId: string;
      depositStatus?: string;
      applied?: string;
    }> = [];
    for (const inv of invoices ?? []) {
      const depositId = (inv as any).provider_transaction_id as string;
      if (!depositId) continue;
      const dep = await this.pawapay.getDepositStatus(depositId);
      if (!dep) continue;
      const status = (dep as any).status as string | undefined;
      const res = await this.applyPawaPayDeposit({
        depositId,
        status,
        failureReason: (dep as any).failureReason,
      });
      synced.push({ depositId, depositStatus: status, applied: res.status });
    }
    return {
      synced,
      activated: synced.some((s) => s.applied === "paid"),
      failed: synced.some((s) => s.applied === "failed"),
    };
  }

  /**
   * Rembourse le dernier paiement mobile money PAYÉ d'un abonnement (à l'annulation).
   * Appelle PawaPay /v2/refunds sur le dépôt d'origine, trace le refundId dans la
   * facture et la bascule en 'refund_pending'. Le statut final vient du polling.
   */
  async refundSubscriptionPayment(tenantId: string, subscriptionId: string) {
    const sb = this.supabase;
    const { data: sub } = await sb
      .from("billing_subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!sub) throw new NotFoundException("Abonnement introuvable");

    const { data: invoices } = await sb
      .from("billing_invoices")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .eq("provider", "pawapay")
      .eq("status", "paid")
      .not("provider_transaction_id", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1);
    const invoice = (invoices ?? [])[0];
    if (!invoice)
      throw new BadRequestException(
        "Aucun paiement mobile money remboursable pour cet abonnement",
      );

    const depositId = String(invoice.provider_transaction_id);
    const currency = String(invoice.currency || "XAF").toUpperCase();
    const amount = BillingService.ZERO_DECIMAL.has(currency)
      ? String(invoice.amount_cents)
      : (invoice.amount_cents / 100).toFixed(2);
    const refundId = randomUUID();

    const init = await this.pawapay.initiateRefund({
      refundId,
      depositId,
      amount,
      currency,
      clientReferenceId: String(invoice.invoice_number ?? invoice.id),
      metadata: [
        { tenant: tenantId },
        { invoice: String(invoice.invoice_number ?? invoice.id) },
        { subscription: subscriptionId },
      ],
    });

    await sb
      .from("billing_invoices")
      .update({
        status: "refund_pending",
        metadata: {
          ...(invoice.metadata ?? {}),
          pawapay_refund_id: refundId,
          refund_status: init.status,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    return {
      refundId,
      status: init.status,
      amount_cents: invoice.amount_cents,
      currency,
      depositId,
      invoiceId: invoice.id,
    };
  }

  /**
   * Polling des remboursements en cours (compte PawaPay partagé → pas de webhook).
   * Pour chaque facture 'refund_pending' du tenant, interroge PawaPay et bascule
   * la facture en 'refunded' (COMPLETED) ou la remet 'paid' (refund échoué).
   */
  async syncPendingRefunds(tenantId: string) {
    const sb = this.supabase;
    const { data: subs } = await sb
      .from("billing_subscriptions")
      .select("id")
      .eq("tenant_id", tenantId);
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (!subIds.length) return { synced: [], refunded: false, failed: false };

    const { data: invoices } = await sb
      .from("billing_invoices")
      .select("id, metadata, status, subscription_id")
      .in("subscription_id", subIds)
      .eq("status", "refund_pending");

    const synced: Array<{
      refundId: string;
      refundStatus?: string;
      applied?: string;
    }> = [];
    for (const inv of invoices ?? []) {
      const refundId = (inv as any)?.metadata?.pawapay_refund_id as
        | string
        | undefined;
      if (!refundId) continue;
      const ref = await this.pawapay.getRefundStatus(refundId);
      if (!ref) continue;
      const status = String((ref as any).status ?? "");
      let applied = status;
      if (status === "COMPLETED") {
        await sb
          .from("billing_invoices")
          .update({
            status: "refunded",
            metadata: {
              ...((inv as any).metadata ?? {}),
              refund_status: "COMPLETED",
              refunded_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", (inv as any).id);
        applied = "refunded";
      } else if (["FAILED", "REJECTED"].includes(status)) {
        await sb
          .from("billing_invoices")
          .update({
            status: "paid", // le refund a échoué → la facture reste payée
            metadata: {
              ...((inv as any).metadata ?? {}),
              refund_status: status,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", (inv as any).id);
        applied = "failed";
      }
      synced.push({ refundId, refundStatus: status, applied });
    }
    return {
      synced,
      refunded: synced.some((s) => s.applied === "refunded"),
      failed: synced.some((s) => s.applied === "failed"),
    };
  }

  /**
   * Renouvellement « push-to-approve » (mobile money). Pour chaque abonnement
   * PawaPay ÉCHU (current_period_end passé) avec un moyen de paiement mémorisé,
   * crée une facture de renouvellement et RE-POUSSE un USSD vers le numéro connu.
   * Le client valide avec son PIN → applyPawaPayDeposit prolonge la période.
   * ⚠️ Le mobile money ne permet PAS de prélèvement silencieux (comme une carte) :
   * on re-sollicite le PIN à chaque cycle. À déclencher par un cron/worker.
   */
  async renewDueSubscriptions(limit = 50) {
    const sb = this.supabase;
    const nowIso = new Date().toISOString();
    const { data: due } = await sb
      .from("billing_subscriptions")
      .select("*")
      .eq("provider", "pawapay")
      .eq("status", "active")
      .lte("current_period_end", nowIso)
      .limit(limit);
    const rows: any[] = Array.isArray(due) ? due : [];
    let initiated = 0;
    let skipped = 0;
    for (const sub of rows) {
      const pm = (sub as any)?.metadata?.payment_method;
      if (!pm?.phone || !pm?.provider) {
        skipped++;
        continue;
      }
      // Anti double-relance : une facture pending/processing est-elle déjà ouverte ?
      const { data: openInv } = await sb
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .in("status", ["pending", "processing"])
        .limit(1);
      if ((openInv ?? []).length) {
        skipped++;
        continue;
      }
      try {
        const { data: plan } = await sb
          .from("billing_plans")
          .select("price_cents, currency, metadata")
          .eq("key", sub.plan_id)
          .maybeSingle();
        if (!plan) {
          skipped++;
          continue;
        }
        const meta = ((plan as any).metadata ?? {}) as any;
        const amountCents = Number(meta.price_xaf ?? (plan as any).price_cents ?? 0);
        const currency = String(meta.price_xaf_currency ?? "XAF");
        if (!amountCents) {
          skipped++;
          continue;
        }
        // Facture de renouvellement (pending) puis push USSD via le collect existant.
        await sb.from("billing_invoices").insert({
          tenant_id: sub.tenant_id,
          subscription_id: sub.id,
          status: "pending",
          amount_cents: amountCents,
          currency,
          invoice_number: `LIRI-R-${Date.now().toString(36).toUpperCase()}`,
        });
        await this.collectSubscriptionViaPawaPay(sub.tenant_id, sub.id, {
          phoneNumber: pm.phone,
          provider: pm.provider,
        });
        initiated++;
      } catch {
        skipped++;
      }
    }
    return { scanned: rows.length, initiated, skipped };
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
    const { data: plan } = await sb
      .from("billing_plans")
      .select("stripe_price_id, label, price_cents, currency, billing_cycle")
      .eq("key", (sub as any).plan_id)
      .maybeSingle();
    const priceId = (plan as any)?.stripe_price_id;
    // Montant = prix du plan (DB) sinon montant de l'abo ; JAMAIS fourni par le client.
    const amountCents = Number((plan as any)?.price_cents ?? (sub as any)?.amount_cents ?? 0);
    if (!priceId && amountCents <= 0) {
      throw new BadRequestException("Aucun prix configuré pour ce plan (carte indisponible)");
    }

    const frontend = process.env.FRONTEND_URL || "https://app.cimolace.space";
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    if (priceId) {
      // Prix Stripe pré-créé (ex: zahir-forfait).
      params.append("line_items[0][price]", priceId);
    } else {
      // Pas de prix Stripe pré-créé → prix INLINE depuis le catalogue (billing_plans).
      // Rend tout plan/add-on payable sans devoir créer un prix Stripe à la main.
      const currency = String((plan as any)?.currency ?? (sub as any)?.currency ?? "EUR").toLowerCase();
      const interval = String((plan as any)?.billing_cycle ?? "monthly").toLowerCase() === "yearly" ? "year" : "month";
      params.append("line_items[0][price_data][currency]", currency);
      params.append("line_items[0][price_data][unit_amount]", String(amountCents));
      params.append("line_items[0][price_data][recurring][interval]", interval);
      params.append("line_items[0][price_data][product_data][name]", String((plan as any)?.label ?? (sub as any)?.plan_id ?? "Abonnement Cimolace"));
    }
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${frontend}/cimolace/billing?card=success&session_id={CHECKOUT_SESSION_ID}&sub=${subscriptionId}`);
    params.append("cancel_url", `${frontend}/cimolace/billing?card=cancel`);
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
      // Le forfait payé remplace les autres abonnements actifs (ex: l'essai medos_standard).
      await this.supersedeOtherActiveSubscriptions(tenantId, subscriptionId);
      // Provisioning produit : activer les moteurs du plan (le paiement « livre »).
      await this.provisionPlanServices(tenantId, (sub as any).plan_id);
    }
    return { paid, status: paid ? "active" : (sub as any).status };
  }

  /**
   * Quand un abonnement devient actif, annule les AUTRES abonnements actifs du
   * même tenant — le forfait payé remplace l'essai (ex: medos_standard 35€).
   */
  private async supersedeOtherActiveSubscriptions(tenantId: string, keepSubscriptionId: string) {
    await this.supabase
      .from("billing_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .neq("id", keepSubscriptionId);
  }

  /**
   * PROVISIONING au paiement : active les moteurs (tenant_services) liés au plan.
   * C'est le maillon qui relie « j'ai payé » à « mon produit est actif ». Source :
   * billing_plans.features.services (override DB) sinon le manifeste PLAN_SERVICE_MAP.
   * Additif + idempotent (upsert active=true ; ne coupe jamais un service existant).
   * Tolérant aux pannes : un échec de provisioning ne casse JAMAIS l'activation de
   * l'abonnement (le client a payé — on ne rejette pas l'ACK pour autant).
   */
  private async provisionPlanServices(tenantId: string | null | undefined, planKey: string | null | undefined) {
    if (!tenantId || !planKey) return;
    try {
      const sb = this.supabase;
      const { data: plan } = await sb.from("billing_plans").select("features").eq("key", planKey).maybeSingle();
      const services = resolvePlanServices(planKey, (plan as any)?.features);
      if (!services.length) {
        console.warn(`[billing provisioning] aucun moteur mappé pour le plan "${planKey}" — rien activé`);
        return;
      }
      const rows = services.map((service_key) => ({ tenant_id: tenantId, service_key, active: true }));
      const { error } = await sb.from("tenant_services").upsert(rows, { onConflict: "tenant_id,service_key" });
      if (error) {
        console.warn(`[billing provisioning] upsert tenant_services échec (tenant=${tenantId}, plan=${planKey}): ${error.message}`);
        return;
      }
      console.log(`[billing provisioning] ${services.length} moteur(s) activé(s) pour tenant=${tenantId} (plan=${planKey})`);
    } catch (e) {
      console.warn(`[billing provisioning] échec (tenant=${tenantId}, plan=${planKey}): ${(e as Error).message}`);
    }
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

  /**
   * Solde ESTIMÉ du tenant pour l'écran « Mes finances » :
   *   encaissé (dépôts mobile money COMPLETED) − retiré (payouts non échoués).
   * Estimation d'après NOS enregistrements ; le disponible réel pour un retrait
   * dépend du wallet pawaPay. Montants en unité mineure (XAF = entier direct).
   */
  async getBalance(tenantId: string) {
    const sb = this.supabase;
    const { data: deps } = await sb
      .from("pawapay_deposits")
      .select("amount_cents, pawapay_status")
      .eq("tenant_id", tenantId);
    const { data: pays } = await sb
      .from("billing_payouts")
      .select("amount_cents, status")
      .eq("tenant_id", tenantId);
    const collectedCents = (deps ?? [])
      .filter((d: any) => String(d.pawapay_status || "").toUpperCase() === "COMPLETED")
      .reduce((s: number, d: any) => s + Number(d.amount_cents || 0), 0);
    const withdrawnCents = (pays ?? [])
      .filter((p: any) => !["failed", "rejected"].includes(String(p.status || "").toLowerCase()))
      .reduce((s: number, p: any) => s + Number(p.amount_cents || 0), 0);
    const availableCents = Math.max(0, collectedCents - withdrawnCents);
    return { collectedCents, withdrawnCents, availableCents, currency: "XAF" };
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

  // ─── Entrées WEBHOOK PawaPay (anti-forge) ──────────────────────────────────
  /**
   * SÉCURITÉ : le webhook /billing/webhook/pawapay est PUBLIC et sa signature
   * n'est pas garantie (secret non configuré → fail-open). Or le payeur connaît
   * son depositId (il initie le collect) : accepter le statut du corps permettait
   * de forger { status:'COMPLETED' } et d'activer un abonnement SANS payer.
   * Règle : le callback n'est qu'un RÉVEIL, jamais une preuve — on re-lit
   * TOUJOURS le statut à la source (API PawaPay) et on n'applique QUE ce statut
   * vérifié. (Le cron syncPendingPayments passe déjà par getDepositStatus.)
   */
  async applyPawaPayDepositFromWebhook(cb: { depositId?: string }) {
    if (!cb?.depositId) return { received: true, matched: false };
    const dep = await this.pawapay.getDepositStatus(cb.depositId).catch(() => null);
    const status = (dep as any)?.status ? String((dep as any).status).toUpperCase() : null;
    if (!status) {
      // API injoignable ou dépôt inconnu chez PawaPay : ne RIEN appliquer
      // (PawaPay re-tentera ; le cron de synchronisation couvre aussi).
      return { received: true, matched: false, status: "unverified" };
    }
    return this.applyPawaPayDeposit({
      depositId: cb.depositId,
      status,
      failureReason: (dep as any)?.failureReason ?? null,
    });
  }

  /** Entrée WEBHOOK payout : même règle — statut re-lu à la source, jamais celui du corps. */
  async applyPayoutCallbackFromWebhook(cb: { payoutId?: string }) {
    if (!cb?.payoutId) return { received: true, matched: false };
    const raw = await this.pawapay.getPayoutStatus(cb.payoutId).catch(() => null);
    // v2 peut renvoyer une enveloppe { data: {...payout...}, status: "FOUND" } — déballer.
    const payout = (raw as any)?.data ?? raw;
    const status = (payout as any)?.status ? String((payout as any).status) : null;
    if (!status || status === "FOUND" || status === "NOT_FOUND") {
      return { received: true, matched: false, status: "unverified" };
    }
    return this.applyPayoutCallback({
      payoutId: cb.payoutId,
      status,
      providerTransactionId: (payout as any)?.providerTransactionId,
      failureReason: (payout as any)?.failureReason,
    });
  }

  // ─── Webhook Stripe (abonnements plateforme) ──────────────────────────────
  // Source de vérité du cycle de vie d'un abonnement : Stripe pousse les
  // événements, on synchronise billing_subscriptions. La signature est vérifiée
  // manuellement en HMAC-SHA256 (pas de dépendance au SDK Stripe).
  async handleWebhook(payload: Buffer, signature: string) {
    // Secret dédié à CET endpoint billing en priorité, fallback sur le générique.
    const secret =
      process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      // Pas de secret configuré : on ACK (évite les retries en boucle) mais on
      // NE traite RIEN (on ne peut pas faire confiance à un événement non signé).
      console.warn(
        "[billing webhook] STRIPE_BILLING_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET absent — événement ignoré",
      );
      return { received: true, ignored: "no_secret" };
    }

    const event = this.verifyStripeSignature(payload, signature, secret);
    if (!event) throw new BadRequestException("Signature Stripe invalide");

    const type: string = event.type;
    const obj = event.data?.object ?? {};
    try {
      switch (type) {
        case "checkout.session.completed":
          await this.onCheckoutCompleted(obj);
          break;
        case "invoice.paid":
        case "invoice.payment_succeeded":
          await this.onInvoicePaid(obj);
          break;
        case "invoice.payment_failed":
          await this.onInvoiceFailed(obj);
          break;
        case "customer.subscription.updated":
          await this.onSubscriptionUpdated(obj);
          break;
        case "customer.subscription.deleted":
          await this.onSubscriptionCanceled(obj);
          break;
        default:
          return { received: true, ignored: type };
      }
    } catch (e) {
      // Erreur applicative : on loggue et on ACK pour ne pas boucler ; à monitorer.
      console.error(`[billing webhook] échec traitement ${type}:`, (e as Error).message);
      return { received: true, type, error: (e as Error).message };
    }
    return { received: true, type };
  }

  /**
   * Vérifie la signature Stripe (`stripe-signature: t=…,v1=…`) en HMAC-SHA256
   * sur `${t}.${raw}`, avec tolérance anti-rejeu de 5 min. Renvoie l'événement
   * parsé si valide, sinon null.
   */
  private verifyStripeSignature(payload: Buffer, header: string | undefined, secret: string): any | null {
    if (!header) return null;
    const parts = header.split(",").map((p) => p.trim());
    const t = parts.find((p) => p.startsWith("t="))?.slice(2);
    const v1 = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
    if (!t || v1.length === 0) return null;

    const ts = parseInt(t, 10);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      console.warn("[billing webhook] timestamp hors tolérance ou invalide");
      return null;
    }

    const expected = createHmac("sha256", secret)
      .update(`${t}.${payload.toString("utf8")}`, "utf8")
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const ok = v1.some((sig) => {
      let buf: Buffer;
      try {
        buf = Buffer.from(sig, "hex");
      } catch {
        return false;
      }
      return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
    });
    if (!ok) return null;

    try {
      return JSON.parse(payload.toString("utf8"));
    } catch {
      return null;
    }
  }

  /** GET /v1/subscriptions/{id} → récupère statut + dates de période faisant foi. */
  private async fetchStripeSubscription(subId: string): Promise<any | null> {
    if (!subId) return null;
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      headers: { Authorization: this.stripeAuth() },
    });
    if (!res.ok) {
      console.error(`[billing webhook] fetch subscription ${subId} → ${res.status}`);
      return null;
    }
    return res.json();
  }

  private unixToIso(unix?: number | null): string | null {
    return unix ? new Date(unix * 1000).toISOString() : null;
  }

  /** Mappe le statut Stripe vers l'enum billing_subscriptions. */
  private mapStripeStatus(s?: string): string {
    switch (s) {
      case "active":
      case "trialing":
        return "active";
      case "past_due":
      case "unpaid":
        return "past_due";
      case "canceled":
        return "canceled";
      case "paused":
        return "paused";
      case "incomplete_expired":
        return "expired";
      default:
        return "pending";
    }
  }

  /** checkout.session.completed (mode subscription) → lie l'abo au sub Stripe + active. */
  private async onCheckoutCompleted(session: any) {
    if (session?.mode && session.mode !== "subscription") return; // ignore le setup one-off
    const sb = this.supabase;
    const rowId = session.client_reference_id || session?.metadata?.subscription_id || null;
    const stripeSubId = session.subscription || null;
    const sub = stripeSubId ? await this.fetchStripeSubscription(stripeSubId) : null;

    const patch: any = {
      status: sub ? this.mapStripeStatus(sub.status) : "active",
      provider: "stripe",
      updated_at: new Date().toISOString(),
    };
    if (stripeSubId) patch.provider_subscription_id = stripeSubId;
    const customer = session.customer ?? sub?.customer ?? null;
    if (customer) patch.provider_customer_id = customer;
    if (sub?.current_period_start) patch.current_period_start = this.unixToIso(sub.current_period_start);
    if (sub?.current_period_end) patch.current_period_end = this.unixToIso(sub.current_period_end);

    const matchCol = rowId ? "id" : "provider_checkout_id";
    const matchVal = rowId || session.id;
    await sb.from("billing_subscriptions").update(patch).eq(matchCol, matchVal);
    if (rowId) {
      await sb
        .from("billing_invoices")
        .update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("subscription_id", rowId)
        .in("status", ["pending", "processing", "failed"]);
    }
    // Si l'abo devient actif, il remplace les autres abos actifs du tenant (essai).
    if (patch.status === "active") {
      const { data: row } = await sb
        .from("billing_subscriptions")
        .select("id, tenant_id, plan_id, amount_cents, currency")
        .eq(matchCol, matchVal)
        .maybeSingle();
      if ((row as any)?.tenant_id) {
        await this.supersedeOtherActiveSubscriptions((row as any).tenant_id, (row as any).id);
        // Provisioning produit : activer les moteurs du plan (le paiement « livre »).
        await this.provisionPlanServices((row as any).tenant_id, (row as any).plan_id);
        this.notifyTenant((row as any).tenant_id, "billing.subscription.activated", {
          subscription_id: (row as any).id,
          plan_id: (row as any).plan_id,
          amount_cents: (row as any).amount_cents,
          currency: (row as any).currency,
          current_period_end: patch.current_period_end ?? null,
        });
      }
    }
  }

  /** invoice.paid / payment_succeeded → renouvellement : prolonge la période + active. */
  private async onInvoicePaid(invoice: any) {
    const subId = invoice.subscription;
    if (!subId) return;
    const sub = await this.fetchStripeSubscription(subId);
    const patch: any = { status: "active", updated_at: new Date().toISOString() };
    if (sub?.current_period_end) patch.current_period_end = this.unixToIso(sub.current_period_end);
    else if (invoice?.lines?.data?.[0]?.period?.end)
      patch.current_period_end = this.unixToIso(invoice.lines.data[0].period.end);
    await this.supabase.from("billing_subscriptions").update(patch).eq("provider_subscription_id", subId);
    // L'abo renouvelé/actif remplace les autres abos actifs du tenant (essai).
    const { data: row } = await this.supabase
      .from("billing_subscriptions")
      .select("id, tenant_id, plan_id")
      .eq("provider_subscription_id", subId)
      .maybeSingle();
    if ((row as any)?.tenant_id) {
      await this.supersedeOtherActiveSubscriptions((row as any).tenant_id, (row as any).id);
      this.notifyTenant((row as any).tenant_id, "billing.invoice.paid", {
        subscription_id: (row as any).id,
        plan_id: (row as any).plan_id,
        amount_cents: invoice.amount_paid ?? null,
        currency: invoice.currency ?? null,
        provider_invoice_id: invoice.id ?? null,
        current_period_end: patch.current_period_end ?? null,
      });
    }
    // facture interne (si suivie) → payée
    await this.supabase
      .from("billing_invoices")
      .update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("provider_transaction_id", invoice.id);
  }

  /** invoice.payment_failed → past_due (déclenche la relance / fenêtre de grâce). */
  private async onInvoiceFailed(invoice: any) {
    const subId = invoice.subscription;
    if (!subId) return;
    await this.supabase
      .from("billing_subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", subId);
    const { data: row } = await this.supabase
      .from("billing_subscriptions")
      .select("id, tenant_id, plan_id")
      .eq("provider_subscription_id", subId)
      .maybeSingle();
    this.notifyTenant((row as any)?.tenant_id, "billing.subscription.past_due", {
      subscription_id: (row as any)?.id ?? null,
      plan_id: (row as any)?.plan_id ?? null,
      amount_cents: invoice.amount_due ?? null,
      currency: invoice.currency ?? null,
      provider_invoice_id: invoice.id ?? null,
    });
  }

  /** customer.subscription.updated → resynchronise statut + période. */
  private async onSubscriptionUpdated(sub: any) {
    const patch: any = { status: this.mapStripeStatus(sub.status), updated_at: new Date().toISOString() };
    if (sub?.current_period_end) patch.current_period_end = this.unixToIso(sub.current_period_end);
    if (sub?.canceled_at) patch.canceled_at = this.unixToIso(sub.canceled_at);
    await this.supabase.from("billing_subscriptions").update(patch).eq("provider_subscription_id", sub.id);
  }

  /** customer.subscription.deleted → canceled → le gating coupe l'accès aux clés. */
  private async onSubscriptionCanceled(sub: any) {
    await this.supabase
      .from("billing_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", sub.id);
    const { data: row } = await this.supabase
      .from("billing_subscriptions")
      .select("id, tenant_id, plan_id")
      .eq("provider_subscription_id", sub.id)
      .maybeSingle();
    this.notifyTenant((row as any)?.tenant_id, "billing.subscription.canceled", {
      subscription_id: (row as any)?.id ?? null,
      plan_id: (row as any)?.plan_id ?? null,
    });
  }
}
