import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { AuthService } from "../auth/auth.service";
import { PawaPayService } from "../pawapay/pawapay.service";
import { WebhookService } from "../liri-public/webhook.service";
import { EmailEngineService } from "../email-engine/email-engine.service";
import { UsageService } from "../usage/usage.service";
import { resolvePlanServices } from "./plan-services";

@Injectable()
export class BillingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private auth: AuthService,
    private pawapay: PawaPayService,
    private tenantWebhooks: WebhookService,
    private email: EmailEngineService,
    private usage: UsageService,
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
  async activateTenantSubscription(tenantId: string, planKey: string, actor?: string) {
    if (!planKey) throw new BadRequestException("planKey requis (aucun forfait par défaut — neutralité §1).");
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

    // SÉCURITÉ §15 : trace attribuable (QUI a activé le forfait + armé le gating).
    try {
      await sb.from("cimolace_change_history").insert({
        action: "billing:activate",
        entity_type: "tenant",
        entity_id: tenantId,
        description: `Forfait ${(plan as any).key} activé + gating armé`,
        changed_by: (actor && actor.trim()) || "Cimolace Ops (non attribué)",
      });
    } catch {
      /* audit best-effort : ne bloque jamais l'opération */
    }

    return { subscription, gating_enabled: true, plan: (plan as any).key };
  }

  /**
   * BACK-OFFICE (owner Cimolace) : génère un LIEN DE PAIEMENT Stripe pour un tenant
   * donné, afin de lui faire régler/reprendre son abonnement. Réutilise l'abo existant
   * le plus pertinent (actif/past_due/pending, sinon le plus récent), ou en crée un
   * pending pour `planKey`. Renvoie l'URL Stripe hébergée — l'owner l'envoie au client.
   * ⚠️ Ne débite RIEN : la carte n'est débitée que si le client paie via le lien.
   */
  async createPaymentLinkForTenant(tenantId: string, planKey?: string, actor?: string, cycle?: string) {
    const sb = this.supabase;
    let subscriptionId: string | undefined;
    let planUsed = planKey;
    if (planKey && planKey.trim()) {
      const r = await this.subscribeToPlan(tenantId, planKey.trim(), "stripe");
      subscriptionId = r.subscription_id;
    } else {
      const { data: subs } = await sb
        .from("billing_subscriptions")
        .select("id, plan_id, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      const rows: any[] = Array.isArray(subs) ? subs : [];
      const rank = (s: string) => (["active", "trialing", "past_due", "unpaid", "pending"].includes(String(s)) ? 1 : 0);
      const primary = rows.sort((a, b) => rank(b.status) - rank(a.status))[0];
      if (!primary) {
        throw new BadRequestException("Aucun abonnement pour ce tenant — précisez un planKey (clé billing_plans).");
      }
      subscriptionId = primary.id;
      planUsed = primary.plan_id;
    }

    const checkout = await this.createCardCheckout(tenantId, subscriptionId!, cycle);

    // SÉCURITÉ §15 : trace attribuable (QUI a généré un lien de paiement pour QUI).
    try {
      await sb.from("cimolace_change_history").insert({
        action: "billing:payment-link",
        entity_type: "tenant",
        entity_id: tenantId,
        description: `Lien de paiement Stripe généré (plan ${planUsed ?? "?"}${cycle ? `, cycle ${cycle}` : ""})`,
        changed_by: (actor && actor.trim()) || "Cimolace Ops (non attribué)",
      });
    } catch {
      /* audit best-effort */
    }

    return {
      url: checkout.url,
      session_id: checkout.session_id,
      subscription_id: subscriptionId,
      plan: planUsed ?? null,
      amount_cents: (checkout as any).amount_cents ?? null,
      currency: (checkout as any).currency ?? null,
    };
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
      // Idempotence : un 2e callback COMPLETED ne doit PAS ré-étendre la période d'un
      // cycle entier. Si la facture est déjà payée, rien à refaire.
      if (inv.status === "paid") return { received: true, matched: true, status: "already_paid" };
      await sb.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", inv.id);
      if (inv.subscription_id) {
        const start = new Date();
        // Moyen de paiement : le numéro/opérateur utilisé (stocké sur la facture au moment du collect).
        const payMethod = (inv.metadata as any)?.payer_phone
          ? { type: "mobile_money", provider: (inv.metadata as any).payer_provider ?? null, phone: (inv.metadata as any).payer_phone }
          : null;
        const { data: subRow } = await sb.from("billing_subscriptions").select("metadata, user_id, tenant_id, plan_id").eq("id", inv.subscription_id).maybeSingle();
        // Échéance selon le CYCLE du plan (fix : un abonnement yearly ne recevait que 30 jours).
        const end = BillingService.addCycle(start, await this.planBillingCycle((subRow as any)?.plan_id));
        await sb.from("billing_subscriptions").update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          metadata: { ...((subRow as any)?.metadata ?? {}), ...(payMethod ? { payment_method: payMethod } : {}) },
          updated_at: new Date().toISOString(),
        }).eq("id", inv.subscription_id);
        // PROVISIONING (fix : le mobile money n'activait AUCUN moteur) + remplacement de
        // l'essai, en parité avec le flux carte (confirmCardPayment).
        const tid = (subRow as any)?.tenant_id;
        if (tid) {
          await this.supersedeOtherActiveSubscriptions(tid, inv.subscription_id);
          await this.provisionPlanServices(tid, (subRow as any)?.plan_id);
        }
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
      // RÉSILIATION programmée (§11) : ne PAS re-solliciter le PIN — l'abo doit expirer.
      if ((sub as any)?.metadata?.cancel_at_period_end) {
        skipped++;
        continue;
      }
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
  async createCardCheckout(tenantId: string, subscriptionId: string, cycleOverride?: string) {
    const auth = this.stripeAuth();
    const sb = this.supabase;
    const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
    if (!sub) throw new NotFoundException("Abonnement introuvable");
    const { data: plan } = await sb
      .from("billing_plans")
      .select("stripe_price_id, label, price_cents, currency, billing_cycle, metadata")
      .eq("key", (sub as any).plan_id)
      .maybeSingle();
    // CYCLE : le client peut choisir mensuel/trimestriel/annuel sur un plan mensuel.
    // Remises standard (alignées sur la grille cycles existante) : trimestriel −10 %,
    // annuel −20 % — surchargables par plan via billing_plans.metadata.cycle_discounts.
    const planCycle = String((plan as any)?.billing_cycle ?? "monthly").toLowerCase();
    const cycle = BillingService.normalizeCycle(cycleOverride) ?? planCycle;
    const cycled = cycle !== planCycle && ["quarterly", "yearly"].includes(cycle);
    let priceId = (plan as any)?.stripe_price_id;
    // Montant = prix du plan (DB) sinon montant de l'abo ; JAMAIS fourni par le client.
    let amountCents = Number((plan as any)?.price_cents ?? (sub as any)?.amount_cents ?? 0);
    let appliedDisc = 0;
    if (cycled && planCycle === "monthly" && amountCents > 0) {
      const disc = BillingService.cycleDiscount((plan as any)?.metadata, cycle);
      appliedDisc = disc;
      const months = cycle === "yearly" ? 12 : 3;
      amountCents = Math.round(amountCents * months * (1 - disc));
      priceId = null; // le prix Stripe pré-créé est mensuel → prix INLINE au bon intervalle
      // Mémoriser le cycle choisi : confirmCardPayment prolonge la période selon lui,
      // et le trigger CRM normalise le MRR (÷3 ou ÷12) grâce à metadata.cycle_override.
      await sb.from("billing_subscriptions").update({
        amount_cents: amountCents,
        metadata: { ...(((sub as any).metadata as Record<string, unknown>) ?? {}), cycle_override: cycle },
        updated_at: new Date().toISOString(),
      }).eq("id", subscriptionId);
    }
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
      // L'intervalle suit le CYCLE effectif (choix client inclus) via cycleToStripeInterval
      // (quarterly = month×3 — un simple yearly?year:month facturait le trimestre chaque mois).
      const currency = String((plan as any)?.currency ?? (sub as any)?.currency ?? "EUR").toLowerCase();
      const iv = BillingService.cycleToStripeInterval(cycle);
      params.append("line_items[0][price_data][currency]", currency);
      params.append("line_items[0][price_data][unit_amount]", String(amountCents));
      params.append("line_items[0][price_data][recurring][interval]", iv.interval);
      if (iv.count > 1) params.append("line_items[0][price_data][recurring][interval_count]", String(iv.count));
      const discPct = appliedDisc > 0 ? ` (−${Math.round(appliedDisc * 100)} %)` : "";
      const cycleLabel = cycle === "yearly" ? ` — Annuel${discPct}` : cycle === "quarterly" ? ` — Trimestriel${discPct}` : "";
      params.append("line_items[0][price_data][product_data][name]", String((plan as any)?.label ?? (sub as any)?.plan_id ?? "Abonnement Cimolace") + cycleLabel);
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
      // Échéance selon le CYCLE (fix : yearly ne donnait que 30 jours). Bootstrap ;
      // pour un abonnement récurrent Stripe, le webhook resynchronise ensuite la période réelle.
      // Le cycle CHOISI au checkout (metadata.cycle_override) prime sur celui du plan —
      // sinon un paiement annuel ne créditerait qu'un mois.
      const start = new Date();
      const chosenCycle =
        BillingService.normalizeCycle((sub as any)?.metadata?.cycle_override) ??
        (await this.planBillingCycle((sub as any).plan_id));
      const end = BillingService.addCycle(start, chosenCycle);
      await sb.from("billing_subscriptions").update({ status: "active", provider_subscription_id: s.subscription ?? null, provider_customer_id: s.customer ?? null, current_period_start: start.toISOString(), current_period_end: end.toISOString(), updated_at: new Date().toISOString() }).eq("id", subscriptionId);
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
   * Fin de période selon le CYCLE du plan (yearly/quarterly/weekly/monthly).
   * Remplace le `setMonth(+1)` codé en dur qui sous-livrait les abonnements
   * annuels (un plan local yearly ne donnait que 30 jours d'accès).
   */
  private static addCycle(from: Date, cycle: string | null | undefined): Date {
    const c = String(cycle ?? "monthly").toLowerCase();
    const d = new Date(from);
    if (c === "yearly") d.setFullYear(d.getFullYear() + 1);
    else if (c === "quarterly") d.setMonth(d.getMonth() + 3);
    else if (c === "weekly") d.setDate(d.getDate() + 7);
    else if (c === "one_time" || c === "lifetime") d.setFullYear(d.getFullYear() + 100); // achat unique → sans expiration pratique
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  /** Cycle client normalisé ('monthly'|'quarterly'|'yearly') ou undefined si invalide/absent. */
  private static normalizeCycle(c: string | null | undefined): string | undefined {
    const v = String(c ?? "").trim().toLowerCase();
    return ["monthly", "quarterly", "yearly"].includes(v) ? v : undefined;
  }

  /** Remise du cycle : billing_plans.metadata.cycle_discounts.{quarterly,yearly} (0..0.5),
   *  sinon défauts alignés sur la grille cycles existante : trimestriel −10 %, annuel −20 %. */
  private static cycleDiscount(planMeta: unknown, cycle: string): number {
    const defaults: Record<string, number> = { quarterly: 0.10, yearly: 0.20 };
    const raw = (planMeta as any)?.cycle_discounts?.[cycle];
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 0.5) return n;
    return defaults[cycle] ?? 0;
  }

  /** Cycle plan → intervalle Stripe (interval + interval_count) pour un prix INLINE
   *  (fix : un 'quarterly' inline était facturé chaque MOIS au prix trimestriel). */
  private static cycleToStripeInterval(cycle: string | null | undefined): { interval: string; count: number } {
    switch (String(cycle ?? "monthly").toLowerCase()) {
      case "yearly": return { interval: "year", count: 1 };
      case "quarterly": return { interval: "month", count: 3 };
      case "weekly": return { interval: "week", count: 1 };
      default: return { interval: "month", count: 1 };
    }
  }

  /** Cycle de facturation d'un plan (pour calculer l'échéance). Défaut mensuel. */
  private async planBillingCycle(planKey: string | null | undefined): Promise<string> {
    if (!planKey) return "monthly";
    const { data } = await this.supabase
      .from("billing_plans").select("billing_cycle").eq("key", planKey).maybeSingle();
    return String((data as any)?.billing_cycle ?? "monthly").toLowerCase();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ACQUISITION — orchestrateur « createTenantFromPurchase » (LE chaînon manquant).
  // Aucun webhook ne créait de tenant depuis un paiement : tout supposait un tenant
  // préexistant → un prospect qui payait tombait dans un drop silencieux. Ce service
  // matérialise le tenant au paiement abouti. Idempotent (claim sur providerRef).
  // ⚠️ Untestable hors runtime — à valider APRÈS déploiement Railway, avant tout
  // paiement réel. Appelé par les handlers de webhook (COMPLETED), pas exposé en HTTP.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Catégorie de plan → kind tenant (CHECK infrastructure_type). Défaut 'liri'. */
  private static categoryToKind(category: string | null | undefined): string {
    const c = String(category || "").toLowerCase();
    if (c.includes("medos")) return "medos";
    if (c.includes("ecole") || c.includes("school")) return "school";
    if (c.includes("bienetre") || c.includes("wellness")) return "wellness";
    if (c.includes("createur") || c.includes("creator")) return "creator";
    if (c.includes("mbolo") || c.includes("commerce")) return "mbolo";
    return "liri";
  }

  /** Offre → hosting_mode. customized = valeur dédiée (tier hébergé + marque tenant). */
  private static hostingModeForOffer(offerTier: string | null | undefined): string {
    const o = String(offerTier || "hosted").toLowerCase();
    if (o === "integration") return "embedded";
    if (o === "customized") return "customized";
    return "hosted";
  }

  private static RESERVED_SLUGS = new Set([
    "admin", "api", "app", "www", "cimolace", "liri", "login", "logout", "static",
    "assets", "public", "dashboard", "billing", "webhook", "medos", "mbolo", "isna",
    "support", "help", "new", "creer-organisation", "t", "auth", "signup",
  ]);

  /** Slug URL-safe (accents retirés, [a-z0-9-], 2..38 car.), hors mots réservés. */
  private static slugify(s: string): string {
    let base = String(s || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 38) || "tenant";
    if (base.length < 2) base = `${base}-t`;
    if (BillingService.RESERVED_SLUGS.has(base)) base = `${base}-org`;
    return base;
  }

  /** Crée/retrouve un user par email (sans password) via Supabase admin. Rôle owner. */
  private async provisionUserByEmail(email: string, firstName?: string, lastName?: string): Promise<{ id: string; isNew: boolean }> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new BadRequestException("Supabase non configuré (acquisition).");
    const em = email.trim().toLowerCase();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const findId = async (): Promise<string | undefined> => {
      const r = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(em)}`, { headers });
      if (!r.ok) return undefined;
      const d = (await r.json()) as { users?: { id: string; email?: string }[] };
      return (d?.users || []).find((u) => u.email?.toLowerCase() === em)?.id;
    };
    const existing = await findId();
    if (existing) return { id: existing, isNew: false };
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST", headers,
      body: JSON.stringify({ email: em, email_confirm: true, user_metadata: { first_name: firstName ?? null, last_name: lastName ?? null, role: "owner", created_via: "acquisition" } }),
    });
    if (createRes.ok) return { id: ((await createRes.json()) as { id: string }).id, isNew: true };
    // Course (2 webhooks en //) : l'user a pu être créé entre-temps → on le retrouve.
    const raced = await findId();
    if (!raced) throw new BadRequestException("Provisionnement du compte impossible.");
    return { id: raced, isNew: false };
  }

  /** Lien d'action Supabase (magiclink = connexion 1-clic, recovery = définir mot de passe).
   *  NE dépend PAS du SMTP Supabase : le lien est renvoyé, on l'envoie via notre email (Resend). */
  private async generateAuthLink(email: string, type: "magiclink" | "recovery", redirectTo: string): Promise<string | null> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    try {
      const r = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, email: email.trim().toLowerCase(), options: { redirect_to: redirectTo } }),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as any;
      return d?.action_link || d?.properties?.action_link || null;
    } catch { return null; }
  }

  /** Email de BIENVENUE + ACCÈS après un achat abouti : le client entre en 1 clic (magic-link)
   *  et, s'il est nouveau, peut définir son mot de passe (recovery). Fail-safe : n'échoue JAMAIS
   *  le provisioning (le paiement est déjà encaissé). */
  private async sendAcquisitionWelcome(tenantId: string, email: string, orgName: string, userIsNew: boolean): Promise<void> {
    try {
      const frontend = (process.env.FRONTEND_URL || "https://app.cimolace.space").replace(/\/$/, "");
      const dest = `${frontend}/cimolace/billing`;
      const magic = await this.generateAuthLink(email, "magiclink", dest);
      const recover = userIsNew ? await this.generateAuthLink(email, "recovery", dest) : null;
      const accessUrl = magic || `${frontend}/cimolace/login`;
      const org = orgName || "votre organisation";
      const secondary = recover
        ? `<p style="font-size:14px;line-height:1.6;margin:14px 0 0">Vous préférez un mot de passe ? <a href="${recover}" style="color:#b6893c;font-weight:600">Définissez-le ici</a> (lien valable un moment).</p>`
        : `<p style="font-size:13px;line-height:1.6;margin:14px 0 0;color:#8a978f">Astuce : une fois connecté, vous pouvez définir un mot de passe dans les réglages de votre espace.</p>`;
      const html = this.email.brandedHtml({
        title: `Bienvenue sur Cimolace — ${org}`,
        body: `Votre paiement est confirmé et votre espace <b>${org}</b> est prêt : votre abonnement est actif et vos outils sont activés. Cliquez ci-dessous pour accéder à votre espace tout de suite.`,
        ctaLabel: "Accéder à mon espace",
        ctaUrl: accessUrl,
        brand: "#b6893c",
      }) + secondary;
      const res = await this.email.sendRaw(tenantId, email, `Votre espace ${org} est prêt — accédez-y`, html);
      this.logger.log(`[acquisition] email d'accès → ${email} (${(res as any)?.status ?? "?"}, magic=${!!magic}, recover=${!!recover})`);
    } catch (e) {
      this.logger.warn(`[acquisition] email d'accès non envoyé à ${email}: ${(e as Error).message}`);
    }
  }

  /** INSERT tenant avec gestion de collision de slug (23505 → suffixe -2, -3…). */
  private async insertTenantForPurchase(p: { name: string; baseSlug: string; ownerUserId: string; kind: string; hostingMode: string; locale: string; timezone: string }): Promise<string> {
    const sb = this.supabase;
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? p.baseSlug : `${p.baseSlug}-${attempt + 1}`;
      const { data, error } = await sb.from("tenants").insert({
        name: p.name, slug, owner_user_id: p.ownerUserId, infrastructure_type: p.kind,
        status: "active", plan: "free", billing_status: "free", locale: p.locale, timezone: p.timezone,
        metadata: { hosting_mode: p.hostingMode, created_via: "acquisition" },
      }).select("id").single();
      if (!error && data) return (data as any).id as string;
      const code = (error as { code?: string } | null)?.code;
      const msg = String((error as { message?: string } | null)?.message || "").toLowerCase();
      if (code === "23505" || /duplicate|unique|already exists/.test(msg)) continue; // slug pris → suffixe
      throw new BadRequestException(`Création du tenant échouée: ${(error as { message?: string } | null)?.message ?? "inconnue"}`);
    }
    throw new BadRequestException("Impossible de générer un slug unique (5 tentatives).");
  }

  /**
   * LE CHAÎNON : crée/active un tenant à partir d'un ACHAT abouti.
   * intent='new_tenant' → crée user+tenant+membership+moteurs+abo actif.
   * intent='existing'   → rattache l'achat à un tenant dont l'user est owner (anti-hijack).
   * Idempotent : si providerRef a déjà produit un abo, ressort tel quel sans rien recréer.
   * ⚠️ Idempotence forte (dédup event.id atomique) = responsabilité de l'appelant webhook (P4).
   */
  async createTenantFromPurchase(p: {
    email: string;
    orgName?: string;
    slug?: string;
    planKey: string;
    offerTier?: string;
    intent?: "new_tenant" | "existing";
    existingTenantId?: string;
    providerRef?: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    firstName?: string;
    lastName?: string;
    locale?: string;
    timezone?: string;
  }): Promise<{ tenantId: string; userId: string; subscriptionId: string | null; created: boolean }> {
    const sb = this.supabase;
    const email = String(p.email || "").trim().toLowerCase();
    if (!email) throw new BadRequestException("email requis pour provisionner l'achat");
    if (!p.planKey) throw new BadRequestException("planKey requis");

    // 0) IDEMPOTENCE (best-effort) : ce paiement a-t-il déjà provisionné un abo ?
    if (p.providerRef) {
      const { data: seen } = await sb.from("billing_subscriptions")
        .select("id, tenant_id, user_id").eq("provider_checkout_id", p.providerRef).maybeSingle();
      if ((seen as any)?.tenant_id) {
        return { tenantId: (seen as any).tenant_id, userId: (seen as any).user_id, subscriptionId: (seen as any).id, created: false };
      }
    }

    // 1) Plan (cycle + catégorie→kind + offre + prix pour l'abo)
    const { data: plan } = await sb.from("billing_plans")
      .select("key, billing_cycle, category, offer_tier, price_cents, currency").eq("key", p.planKey).maybeSingle();
    if (!plan) throw new NotFoundException(`Plan « ${p.planKey} » introuvable`);
    // offer_tier = STRICTEMENT le plan (jamais l'appelant → branding lié au payé).
    const offerTier = String((plan as any).offer_tier ?? "hosted").toLowerCase();
    const kind = BillingService.categoryToKind((plan as any).category);
    const hostingMode = BillingService.hostingModeForOffer(offerTier);

    // 2) USER par email (sans password) — isNew pilote l'email « définir mot de passe ».
    const { id: userId, isNew: userIsNew } = await this.provisionUserByEmail(email, p.firstName, p.lastName);

    // 3) TENANT — rattacher (existing, owner requis) ou créer (new)
    let tenantId: string;
    let created = false;
    if (p.intent === "existing" && p.existingTenantId) {
      const { data: t } = await sb.from("tenants").select("id, owner_user_id").eq("id", p.existingTenantId).maybeSingle();
      if (!t) throw new NotFoundException("Tenant cible introuvable");
      const { data: mem } = await sb.from("tenant_memberships")
        .select("role").eq("tenant_id", p.existingTenantId).eq("user_id", userId).maybeSingle();
      const owner = (t as any).owner_user_id === userId || ["owner", "admin"].includes(String((mem as any)?.role || ""));
      if (!owner) throw new BadRequestException("Rattachement refusé : vous n'êtes pas propriétaire de ce tenant");
      tenantId = (t as any).id as string;
    } else {
      const baseSlug = BillingService.slugify(p.slug || p.orgName || email.split("@")[0]);
      tenantId = await this.insertTenantForPurchase({
        name: p.orgName || baseSlug, baseSlug, ownerUserId: userId, kind, hostingMode,
        locale: p.locale ?? "fr", timezone: p.timezone ?? "Europe/Paris",
      });
      created = true;
    }

    // 4) Membership owner (idempotent)
    await sb.from("tenant_memberships").upsert(
      { tenant_id: tenantId, user_id: userId, role: "owner", status: "active" },
      { onConflict: "tenant_id,user_id" },
    );

    // 5) PROVISIONING des moteurs (fail-safe : n'échoue jamais l'activation)
    await this.provisionPlanServices(tenantId, p.planKey);

    // 6) Abonnement actif, durée = cycle, LIÉ au subscription Stripe (sinon les
    //    renouvellements/annulations Stripe n'atteignent jamais cet abo → accès figé).
    const start = new Date();
    const end = BillingService.addCycle(start, String((plan as any).billing_cycle));
    const { data: sub, error: subErr } = await sb.from("billing_subscriptions").insert({
      tenant_id: tenantId, user_id: userId, plan_id: p.planKey, status: "active",
      provider: "stripe",
      provider_checkout_id: p.providerRef ?? null,
      provider_subscription_id: p.stripeSubscriptionId ?? null,
      provider_customer_id: p.stripeCustomerId ?? null,
      amount_cents: Number((plan as any).price_cents ?? 0),
      currency: String((plan as any).currency ?? "EUR"),
      current_period_start: start.toISOString(), current_period_end: end.toISOString(),
      metadata: { offer_tier: offerTier, acquisition: true },
    }).select("id").maybeSingle();
    // FATAL : sans abo, le tenant est provisionné mais vu comme NON payé (gating) et
    // l'idempotence (providerRef) est annulée → double tenant au rejeu. On lève, et si
    // le tenant venait d'être CRÉÉ on nettoie l'orphelin (best-effort) pour qu'un retry
    // Stripe reparte propre (sinon collision de slug → tenant en double).
    if (subErr) {
      if (created) {
        await sb.from("tenant_services").delete().eq("tenant_id", tenantId);
        await sb.from("tenant_memberships").delete().eq("tenant_id", tenantId);
        await sb.from("tenants").delete().eq("id", tenantId);
      }
      throw new InternalServerErrorException(`Abonnement d'acquisition non enregistré: ${subErr.message}`);
    }
    // L'abo payé remplace tout autre abo actif (essai) — parité avec les autres flux.
    await this.supersedeOtherActiveSubscriptions(tenantId, (sub as any)?.id);

    // 7) EMAIL D'ACCÈS — tient la promesse de la page de succès (« vous recevez un email »).
    //    Uniquement sur création d'un espace (acquisition) ; fail-safe (n'échoue pas l'achat).
    if (created && p.intent !== "existing") {
      await this.sendAcquisitionWelcome(tenantId, email, p.orgName || "", userIsNew);
    }

    this.logger.log(`[acquisition] tenant ${created ? "créé" : "rattaché"} ${tenantId} (plan=${p.planKey}, offre=${offerTier}, kind=${kind}) pour ${email}`);
    return { tenantId, userId, subscriptionId: (sub as any)?.id ?? null, created };
  }

  /**
   * P2 — ENTRÉE ACQUISITION (carte) : un PROSPECT sans tenant démarre un achat.
   * Crée une Stripe Checkout Session PORTANT l'intention (offre + org) en metadata,
   * que le webhook (onCheckoutCompleted) lira pour appeler createTenantFromPurchase.
   * Prix depuis billing_plans (jamais du client). Route publique (pas de tenant requis).
   */
  async createAcquisitionCheckout(dto: {
    email?: string;
    planKey?: string;
    offerTier?: string;
    intent?: "new_tenant" | "existing";
    orgName?: string;
    slug?: string;
    existingTenantId?: string;
  }): Promise<{ url: string }> {
    const auth = this.stripeAuth();
    const sb = this.supabase;
    const email = String(dto?.email || "").trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) throw new BadRequestException("Email valide requis");
    if (!dto?.planKey) throw new BadRequestException("planKey requis");
    const intent = dto.intent === "existing" ? "existing" : "new_tenant";
    if (intent === "new_tenant" && !dto.orgName) throw new BadRequestException("Le nom de l'organisation est requis");
    if (intent === "existing" && !dto.existingTenantId) throw new BadRequestException("existingTenantId requis pour rattacher");

    const { data: plan } = await sb.from("billing_plans")
      .select("key, stripe_price_id, label, price_cents, currency, billing_cycle, offer_tier, is_active, features")
      .eq("key", dto.planKey).maybeSingle();
    if (!plan || (plan as any).is_active === false) throw new NotFoundException("Offre inconnue ou inactive");
    const priceId = (plan as any).stripe_price_id;
    const amountCents = Number((plan as any).price_cents ?? 0);
    if (!priceId && amountCents <= 0) throw new BadRequestException("Aucun prix carte configuré pour ce plan");
    // Ne jamais encaisser un plan qui ne débloque AUCUN moteur (paiement sans produit).
    if (!resolvePlanServices(dto.planKey, (plan as any).features).length) {
      throw new BadRequestException("Ce plan n'active aucun produit — souscription bloquée");
    }
    // offer_tier = STRICTEMENT le plan (jamais dto.offerTier → sinon branding découplé du payé).
    const offerTier = String((plan as any).offer_tier ?? "hosted").toLowerCase();

    const frontend = process.env.FRONTEND_URL || "https://app.cimolace.space";
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    if (priceId) {
      params.append("line_items[0][price]", priceId);
    } else {
      const currency = String((plan as any).currency ?? "EUR").toLowerCase();
      const { interval, count } = BillingService.cycleToStripeInterval((plan as any).billing_cycle);
      params.append("line_items[0][price_data][currency]", currency);
      params.append("line_items[0][price_data][unit_amount]", String(amountCents));
      params.append("line_items[0][price_data][recurring][interval]", interval);
      params.append("line_items[0][price_data][recurring][interval_count]", String(count));
      params.append("line_items[0][price_data][product_data][name]", String((plan as any).label ?? dto.planKey));
    }
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${frontend}/creer-organisation/succes?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${frontend}/creer-organisation?annule=1`);
    params.append("customer_email", email);
    // Intention d'ACQUISITION — lue par le webhook (createTenantFromPurchase).
    params.append("metadata[intent]", intent);
    params.append("metadata[plan_key]", dto.planKey);
    params.append("metadata[offer_tier]", offerTier);
    params.append("metadata[org_email]", email);
    if (dto.orgName) params.append("metadata[org_name]", dto.orgName);
    if (dto.slug) params.append("metadata[org_slug]", dto.slug);
    if (dto.existingTenantId) params.append("metadata[existing_tenant_id]", dto.existingTenantId);
    // Miroir sur l'abonnement Stripe (metadata persistée pour les renouvellements).
    params.append("subscription_data[metadata][intent]", intent);
    params.append("subscription_data[metadata][plan_key]", dto.planKey);
    params.append("subscription_data[metadata][offer_tier]", offerTier);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) throw new BadRequestException(`Stripe checkout ${res.status}: ${await res.text()}`);
    const s = (await res.json()) as { url?: string };
    if (!s.url) throw new BadRequestException("Session Stripe créée sans URL");
    return { url: s.url };
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
          await this.onCheckoutCompleted(obj, event.id);
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
      // On loggue ET on RE-LÈVE : Stripe doit RÉESSAYER un échec transitoire (sinon un
      // paiement encaissé peut être perdu sans provisioning — cf. revue chaînon). Stripe
      // abandonne après ~3 j (pas de boucle infinie) ; l'événement reste visible côté Stripe.
      console.error(`[billing webhook] échec traitement ${type}:`, (e as Error).message);
      throw e;
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

  // RÉSILIATION §11 : politique unique (fin de période) = tenant-portal
  // (POST /tenant-portal/subscriptions/:id/cancel + /reactivate). Le flag local
  // metadata.cancel_at_period_end est respecté par renewDueSubscriptions (le cron saute
  // les résiliés → l'abo expire à l'échéance). (Ancien doublon /billing/subscription/cancel retiré.)

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

  /**
   * Dédup d'événements webhook (anti double-traitement au retry Stripe).
   * INSERT dans billing_webhook_events (event_id PK) : true au 1er passage, false si
   * déjà vu (23505). Fail-open sur erreur DB — l'idempotence best-effort de
   * createTenantFromPurchase (providerRef) reste un 2e filet contre le double-tenant.
   */
  private async claimWebhookEvent(eventId: string): Promise<boolean> {
    const { error } = await this.supabase.from("billing_webhook_events").insert({ event_id: eventId });
    if (!error) return true;
    if ((error as { code?: string }).code === "23505") return false;
    this.logger.warn(`[webhook dedup] claim échec (${eventId}): ${error.message}`);
    return true; // fail-open : mieux vaut retraiter (idempotent) que perdre l'événement
  }

  /** Relâche un claim d'événement (échec de traitement → permettre le retry Stripe). */
  private async releaseWebhookEvent(eventId: string): Promise<void> {
    try { await this.supabase.from("billing_webhook_events").delete().eq("event_id", eventId); }
    catch (e) { this.logger.warn(`[webhook dedup] release échec (${eventId}): ${(e as Error).message}`); }
  }

  /** checkout.session.completed (mode subscription) → lie l'abo au sub Stripe + active. */
  private async onCheckoutCompleted(session: any, eventId?: string) {
    // ── PACKS DE CRÉDITS (mode=payment, metadata.credit_pack) : créditer le compteur
    // d'usage du tenant. Idempotence par event.id (claim atomique) ; paiement vérifié.
    if (session?.mode === "payment" && session?.metadata?.credit_pack) {
      if (eventId && !(await this.claimWebhookEvent(eventId))) {
        this.logger.log(`[packs] event ${eventId} déjà traité — ignoré`);
        return;
      }
      const paid = session.payment_status === "paid" || session.status === "complete";
      if (!paid) {
        this.logger.warn(`[packs] session ${session.id} non payée (${session.payment_status}) — ignorée`);
        if (eventId) await this.releaseWebhookEvent(eventId);
        return;
      }
      try {
        await this.usage.applyPackFromCheckout(session.metadata, session.id);
      } catch (e) {
        if (eventId) await this.releaseWebhookEvent(eventId); // non-2xx → Stripe rejoue
        throw e;
      }
      return;
    }
    if (session?.mode && session.mode !== "subscription") return; // ignore le setup one-off
    const sb = this.supabase;

    // ── P4 — ACQUISITION : un checkout portant une INTENTION org CRÉE le tenant.
    // Sans ça, un prospect sans sub préexistante tombait dans un UPDATE 0-ligne
    // SILENCIEUX (payé, rien provisionné). Dédup event.id = anti double-tenant au retry.
    const meta = session?.metadata ?? {};
    if (meta.intent === "new_tenant" || meta.intent === "existing") {
      // Dédup atomique (event_id) AVANT le travail : empêche 2 livraisons concurrentes
      // de créer 2 tenants. Sur échec, on RELÂCHE le claim + on RE-LÈVE (retry Stripe).
      if (eventId && !(await this.claimWebhookEvent(eventId))) {
        this.logger.log(`[acquisition] event ${eventId} déjà traité — ignoré`);
        return;
      }
      // Ne provisionner QUE si le paiement est réellement abouti (async/impayé → non).
      const paid = session.payment_status === "paid" || session.status === "complete";
      if (!paid) {
        this.logger.warn(`[acquisition] session ${session.id} non payée (payment_status=${session.payment_status}) — ignorée`);
        if (eventId) await this.releaseWebhookEvent(eventId); // un futur 'completed' pourra retenter
        return;
      }
      // Email AUTORITAIRE = celui vérifié par Stripe au paiement (pas la metadata client).
      const email = session.customer_details?.email || session.customer_email || meta.org_email;
      try {
        await this.createTenantFromPurchase({
          email,
          orgName: meta.org_name,
          slug: meta.org_slug,
          planKey: meta.plan_key,
          offerTier: meta.offer_tier,
          intent: meta.intent,
          existingTenantId: meta.existing_tenant_id || undefined,
          providerRef: session.id,
          stripeSubscriptionId: session.subscription || undefined,
          stripeCustomerId: session.customer || undefined,
        });
      } catch (e) {
        // Échec : libérer le claim + RE-LEVER → non-2xx → Stripe rejoue (l'orchestrateur
        // est idempotent sur providerRef). Sinon paiement encaissé, perdu sans rejeu.
        if (eventId) await this.releaseWebhookEvent(eventId);
        throw e;
      }
      return;
    }

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
    const { data: updatedRows, error: updErr } = await sb.from("billing_subscriptions").update(patch).eq(matchCol, matchVal).select("id");
    if (updErr) {
      // Erreur DB réelle (≠ 0 ligne légitime) : re-lever → retry Stripe.
      this.logger.error(`[billing webhook] échec UPDATE abo (session=${session.id}): ${updErr.message}`);
      throw new InternalServerErrorException(updErr.message);
    }
    if (!updatedRows || updatedRows.length === 0) {
      // Fix du DROP SILENCIEUX : un UPDATE PostgREST sans ligne correspondante ne lève
      // rien. On loggue au lieu de laisser un paiement encaissé sans provisioning ni trace.
      this.logger.warn(`[billing webhook] checkout.session.completed sans abonnement correspondant (session=${session.id}, ref=${rowId ?? "∅"}) — aucun provisioning`);
      return;
    }
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
