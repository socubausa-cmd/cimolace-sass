"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const auth_service_1 = require("../auth/auth.service");
const pawapay_service_1 = require("../pawapay/pawapay.service");
const webhook_service_1 = require("../liri-public/webhook.service");
const email_engine_service_1 = require("../email-engine/email-engine.service");
const plan_services_1 = require("./plan-services");
let BillingService = BillingService_1 = class BillingService {
    constructor(auth, pawapay, tenantWebhooks, email) {
        this.auth = auth;
        this.pawapay = pawapay;
        this.tenantWebhooks = tenantWebhooks;
        this.email = email;
        this.logger = new common_1.Logger(BillingService_1.name);
    }
    get supabase() { return this.auth.getClient(); }
    onApplicationBootstrap() {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const run = () => this.renewDueSubscriptions()
            .then((r) => {
            if (r.initiated)
                this.logger.log(`Renouvellements relancés: ${r.initiated}/${r.scanned}`);
        })
            .catch((e) => this.logger.warn(`renewDueSubscriptions: ${e.message}`));
        setTimeout(() => { void run(); setInterval(() => void run(), DAY_MS); }, 60_000);
    }
    notifyTenant(tenantId, event, data) {
        if (!tenantId)
            return;
        this.tenantWebhooks
            .emit(tenantId, event, data)
            .catch((e) => console.warn(`[billing webhook] émission tenant_webhooks échouée: ${e.message}`));
    }
    async getSubscription(tenantId) {
        const { data } = await this.supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).single();
        return data;
    }
    async createSubscription(tenantId, plan, provider) {
        const { data } = await this.supabase.from("subscriptions").insert({ tenant_id: tenantId, plan, provider, status: "active" }).select().single();
        return data;
    }
    async getInvoices(tenantId) {
        const { data } = await this.supabase.from("invoices").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async getTenantSubscription(tenantId) {
        const { data: subs } = await this.supabase
            .from("billing_subscriptions").select("*")
            .eq("tenant_id", tenantId).order("created_at", { ascending: false });
        const { data: invoices } = await this.supabase
            .from("billing_invoices").select("*")
            .eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return { subscriptions: subs ?? [], invoices: invoices ?? [] };
    }
    async activateTenantSubscription(tenantId, planKey = "zahir-forfait") {
        const sb = this.supabase;
        const { data: plan } = await sb
            .from("billing_plans")
            .select("key, label, price_cents, currency")
            .eq("key", planKey)
            .maybeSingle();
        if (!plan)
            throw new common_1.NotFoundException(`Plan "${planKey}" introuvable dans billing_plans`);
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
                plan_id: plan.key,
                provider: "stripe",
                status: "active",
                amount_cents: plan.price_cents ?? 0,
                currency: plan.currency ?? "EUR",
                current_period_start: new Date().toISOString(),
                current_period_end: null,
                metadata: { activated_from: "backoffice", forfait: true },
            })
                .select()
                .single();
            if (error)
                throw new common_1.BadRequestException(`Création abonnement impossible: ${error.message}`);
            subscription = created;
        }
        const { data: t } = await sb.from("tenants").select("metadata").eq("id", tenantId).maybeSingle();
        const meta = t?.metadata ?? {};
        const merged = { ...meta, billing: { ...(meta.billing ?? {}), api_gating: true } };
        await sb
            .from("tenants")
            .update({ metadata: merged, updated_at: new Date().toISOString() })
            .eq("id", tenantId);
        await this.provisionPlanServices(tenantId, plan.key);
        return { subscription, gating_enabled: true, plan: plan.key };
    }
    async subscribeToPlan(tenantId, planKey, provider = "stripe") {
        if (!planKey)
            throw new common_1.BadRequestException("planKey requis");
        const prov = String(provider || "stripe").toLowerCase();
        if (!BillingService_1.PAYMENT_PROVIDERS.has(prov)) {
            throw new common_1.BadRequestException(`provider invalide (autorisés: ${[...BillingService_1.PAYMENT_PROVIDERS].join(", ")})`);
        }
        const sb = this.supabase;
        const { data: plan } = await sb
            .from("billing_plans")
            .select("key, label, price_cents, currency, is_active, metadata")
            .eq("key", planKey)
            .maybeSingle();
        if (!plan || plan.is_active === false) {
            throw new common_1.NotFoundException(`Plan "${planKey}" introuvable ou inactif`);
        }
        const meta = (plan.metadata ?? {});
        let amountCents;
        let currency;
        if (prov === "pawapay") {
            amountCents = Number(meta.price_xaf ?? 0);
            currency = String(meta.price_xaf_currency ?? "XAF");
            if (!amountCents) {
                throw new common_1.BadRequestException(`Paiement mobile money indisponible pour "${planKey}" : prix XAF non configuré (billing_plans.metadata.price_xaf).`);
            }
        }
        else {
            amountCents = Number(plan.price_cents ?? 0);
            currency = String(plan.currency ?? "EUR");
        }
        const { data: existing } = await sb
            .from("billing_subscriptions")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("plan_id", planKey)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .maybeSingle();
        let subscriptionId = existing?.id;
        if (subscriptionId) {
            await sb.from("billing_subscriptions")
                .update({ provider: prov, amount_cents: amountCents, currency, updated_at: new Date().toISOString() })
                .eq("id", subscriptionId);
        }
        else {
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
                metadata: { source: "self-serve-upgrade", plan_label: plan.label },
            })
                .select("id")
                .single();
            if (error || !created) {
                throw new common_1.BadRequestException(`Création abonnement impossible: ${error?.message ?? "inconnue"}`);
            }
            subscriptionId = created.id;
        }
        const { data: openInv } = await sb
            .from("billing_invoices")
            .select("id")
            .eq("subscription_id", subscriptionId)
            .in("status", ["pending", "processing", "failed"])
            .limit(1)
            .maybeSingle();
        let invoiceId = openInv?.id;
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
                description: `Abonnement ${plan.label ?? planKey}`,
            })
                .select("id")
                .maybeSingle();
            invoiceId = inv?.id;
        }
        return {
            subscription_id: subscriptionId,
            invoice_id: invoiceId ?? null,
            plan: { key: planKey, label: plan.label, price_cents: amountCents, currency },
            status: "pending",
        };
    }
    async collectSubscriptionViaPawaPay(tenantId, subscriptionId, dto) {
        if (!dto?.phoneNumber || !dto?.provider) {
            throw new common_1.BadRequestException("phoneNumber et provider (opérateur mobile money, ex: MTN_MOMO_CMR) requis");
        }
        const sb = this.supabase;
        const { data: sub } = await sb.from("billing_subscriptions")
            .select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
        if (!sub)
            throw new common_1.NotFoundException("Abonnement introuvable");
        const { data: invoices } = await sb.from("billing_invoices")
            .select("*").eq("subscription_id", subscriptionId)
            .in("status", ["pending", "processing", "failed"])
            .order("created_at", { ascending: false }).limit(1);
        const invoice = (invoices ?? [])[0];
        if (!invoice)
            throw new common_1.NotFoundException("Aucune facture à régler pour cet abonnement");
        const depositId = (0, crypto_1.randomUUID)();
        const init = await this.pawapay.initiateDeposit({
            depositId,
            amount: String(invoice.amount_cents),
            currency: invoice.currency,
            payer: { type: "MMO", accountDetails: { phoneNumber: String(dto.phoneNumber).replace(/[^0-9]/g, ""), provider: dto.provider } },
            clientReferenceId: String(invoice.invoice_number ?? invoice.id),
            customerMessage: "Cimolace LIRI",
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
    async applyPawaPayDeposit(cb) {
        if (!cb?.depositId)
            return { received: true, matched: false };
        const sb = this.supabase;
        const { data: inv } = await sb.from("billing_invoices")
            .select("*").eq("provider_transaction_id", cb.depositId).maybeSingle();
        if (!inv)
            return { received: true, matched: false };
        if (cb.status === "COMPLETED") {
            await sb.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", inv.id);
            if (inv.subscription_id) {
                const start = new Date();
                const end = new Date();
                end.setMonth(end.getMonth() + 1);
                const payMethod = inv.metadata?.payer_phone
                    ? { type: "mobile_money", provider: inv.metadata.payer_provider ?? null, phone: inv.metadata.payer_phone }
                    : null;
                const { data: subRow } = await sb.from("billing_subscriptions").select("metadata, user_id, tenant_id").eq("id", inv.subscription_id).maybeSingle();
                await sb.from("billing_subscriptions").update({
                    status: "active",
                    current_period_start: start.toISOString(),
                    current_period_end: end.toISOString(),
                    metadata: { ...(subRow?.metadata ?? {}), ...(payMethod ? { payment_method: payMethod } : {}) },
                    updated_at: new Date().toISOString(),
                }).eq("id", inv.subscription_id);
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
    async sendPaymentReceiptEmail(inv, sub, payMethod, periodEnd) {
        try {
            const userId = sub?.user_id;
            const tenantId = sub?.tenant_id ?? inv?.tenant_id;
            if (!userId || !tenantId)
                return;
            const { data: userRes } = await this.supabase.auth.admin.getUserById(userId);
            const to = userRes?.user?.email;
            if (!to)
                return;
            const cur = String(inv.currency ?? "").toUpperCase();
            const amount = BillingService_1.ZERO_DECIMAL.has(cur)
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
        }
        catch {
        }
    }
    async syncPendingPawaPayDeposits(tenantId) {
        const sb = this.supabase;
        const { data: subs } = await sb
            .from("billing_subscriptions")
            .select("id")
            .eq("tenant_id", tenantId);
        const subIds = (subs ?? []).map((s) => s.id);
        if (!subIds.length)
            return { synced: [], activated: false, failed: false };
        const { data: invoices } = await sb
            .from("billing_invoices")
            .select("id, provider_transaction_id, subscription_id, status")
            .in("subscription_id", subIds)
            .eq("provider", "pawapay")
            .in("status", ["processing", "pending"])
            .not("provider_transaction_id", "is", null);
        const synced = [];
        for (const inv of invoices ?? []) {
            const depositId = inv.provider_transaction_id;
            if (!depositId)
                continue;
            const dep = await this.pawapay.getDepositStatus(depositId);
            if (!dep)
                continue;
            const status = dep.status;
            const res = await this.applyPawaPayDeposit({
                depositId,
                status,
                failureReason: dep.failureReason,
            });
            synced.push({ depositId, depositStatus: status, applied: res.status });
        }
        return {
            synced,
            activated: synced.some((s) => s.applied === "paid"),
            failed: synced.some((s) => s.applied === "failed"),
        };
    }
    async refundSubscriptionPayment(tenantId, subscriptionId) {
        const sb = this.supabase;
        const { data: sub } = await sb
            .from("billing_subscriptions")
            .select("*")
            .eq("id", subscriptionId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        if (!sub)
            throw new common_1.NotFoundException("Abonnement introuvable");
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
            throw new common_1.BadRequestException("Aucun paiement mobile money remboursable pour cet abonnement");
        const depositId = String(invoice.provider_transaction_id);
        const currency = String(invoice.currency || "XAF").toUpperCase();
        const amount = BillingService_1.ZERO_DECIMAL.has(currency)
            ? String(invoice.amount_cents)
            : (invoice.amount_cents / 100).toFixed(2);
        const refundId = (0, crypto_1.randomUUID)();
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
    async syncPendingRefunds(tenantId) {
        const sb = this.supabase;
        const { data: subs } = await sb
            .from("billing_subscriptions")
            .select("id")
            .eq("tenant_id", tenantId);
        const subIds = (subs ?? []).map((s) => s.id);
        if (!subIds.length)
            return { synced: [], refunded: false, failed: false };
        const { data: invoices } = await sb
            .from("billing_invoices")
            .select("id, metadata, status, subscription_id")
            .in("subscription_id", subIds)
            .eq("status", "refund_pending");
        const synced = [];
        for (const inv of invoices ?? []) {
            const refundId = inv?.metadata?.pawapay_refund_id;
            if (!refundId)
                continue;
            const ref = await this.pawapay.getRefundStatus(refundId);
            if (!ref)
                continue;
            const status = String(ref.status ?? "");
            let applied = status;
            if (status === "COMPLETED") {
                await sb
                    .from("billing_invoices")
                    .update({
                    status: "refunded",
                    metadata: {
                        ...(inv.metadata ?? {}),
                        refund_status: "COMPLETED",
                        refunded_at: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                })
                    .eq("id", inv.id);
                applied = "refunded";
            }
            else if (["FAILED", "REJECTED"].includes(status)) {
                await sb
                    .from("billing_invoices")
                    .update({
                    status: "paid",
                    metadata: {
                        ...(inv.metadata ?? {}),
                        refund_status: status,
                    },
                    updated_at: new Date().toISOString(),
                })
                    .eq("id", inv.id);
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
        const rows = Array.isArray(due) ? due : [];
        let initiated = 0;
        let skipped = 0;
        for (const sub of rows) {
            const pm = sub?.metadata?.payment_method;
            if (!pm?.phone || !pm?.provider) {
                skipped++;
                continue;
            }
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
                const meta = (plan.metadata ?? {});
                const amountCents = Number(meta.price_xaf ?? plan.price_cents ?? 0);
                const currency = String(meta.price_xaf_currency ?? "XAF");
                if (!amountCents) {
                    skipped++;
                    continue;
                }
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
            }
            catch {
                skipped++;
            }
        }
        return { scanned: rows.length, initiated, skipped };
    }
    stripeAuth() {
        const secret = process.env.STRIPE_SECRET_KEY;
        if (!secret)
            throw new common_1.BadRequestException("Paiement carte indisponible (STRIPE_SECRET_KEY non configurée)");
        return `Basic ${Buffer.from(secret + ":").toString("base64")}`;
    }
    async createCardCheckout(tenantId, subscriptionId) {
        const auth = this.stripeAuth();
        const sb = this.supabase;
        const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
        if (!sub)
            throw new common_1.NotFoundException("Abonnement introuvable");
        const { data: plan } = await sb
            .from("billing_plans")
            .select("stripe_price_id, label, price_cents, currency, billing_cycle")
            .eq("key", sub.plan_id)
            .maybeSingle();
        const priceId = plan?.stripe_price_id;
        const amountCents = Number(plan?.price_cents ?? sub?.amount_cents ?? 0);
        if (!priceId && amountCents <= 0) {
            throw new common_1.BadRequestException("Aucun prix configuré pour ce plan (carte indisponible)");
        }
        const frontend = process.env.FRONTEND_URL || "https://app.cimolace.space";
        const params = new URLSearchParams();
        params.append("mode", "subscription");
        if (priceId) {
            params.append("line_items[0][price]", priceId);
        }
        else {
            const currency = String(plan?.currency ?? sub?.currency ?? "EUR").toLowerCase();
            const interval = String(plan?.billing_cycle ?? "monthly").toLowerCase() === "yearly" ? "year" : "month";
            params.append("line_items[0][price_data][currency]", currency);
            params.append("line_items[0][price_data][unit_amount]", String(amountCents));
            params.append("line_items[0][price_data][recurring][interval]", interval);
            params.append("line_items[0][price_data][product_data][name]", String(plan?.label ?? sub?.plan_id ?? "Abonnement Cimolace"));
        }
        params.append("line_items[0][quantity]", "1");
        params.append("success_url", `${frontend}/cimolace/billing?card=success&session_id={CHECKOUT_SESSION_ID}&sub=${subscriptionId}`);
        params.append("cancel_url", `${frontend}/cimolace/billing?card=cancel`);
        params.append("client_reference_id", subscriptionId);
        params.append("metadata[tenant_id]", tenantId);
        params.append("metadata[subscription_id]", subscriptionId);
        if (sub.customer_email)
            params.append("customer_email", sub.customer_email);
        const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new common_1.BadRequestException(`Stripe Checkout error ${res.status}: ${t.slice(0, 300)}`);
        }
        const session = (await res.json());
        await sb.from("billing_subscriptions").update({ provider: "stripe", provider_checkout_id: session.id, updated_at: new Date().toISOString() }).eq("id", subscriptionId);
        return { url: session.url, session_id: session.id, amount_cents: sub.amount_cents, currency: sub.currency };
    }
    async confirmCardPayment(tenantId, subscriptionId) {
        const auth = this.stripeAuth();
        const sb = this.supabase;
        const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
        if (!sub)
            throw new common_1.NotFoundException("Abonnement introuvable");
        const sessionId = sub.provider_checkout_id;
        if (!sessionId)
            return { paid: false, status: sub.status };
        const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: { Authorization: auth } });
        if (!res.ok)
            throw new common_1.BadRequestException(`Stripe session lookup ${res.status}`);
        const s = (await res.json());
        const paid = s.payment_status === "paid" || s.status === "complete";
        if (paid) {
            const end = new Date();
            end.setMonth(end.getMonth() + 1);
            await sb.from("billing_subscriptions").update({ status: "active", provider_subscription_id: s.subscription ?? null, provider_customer_id: s.customer ?? null, current_period_end: end.toISOString(), updated_at: new Date().toISOString() }).eq("id", subscriptionId);
            await sb.from("billing_invoices").update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("subscription_id", subscriptionId).in("status", ["pending", "processing", "failed"]);
            await this.supersedeOtherActiveSubscriptions(tenantId, subscriptionId);
            await this.provisionPlanServices(tenantId, sub.plan_id);
        }
        return { paid, status: paid ? "active" : sub.status };
    }
    async supersedeOtherActiveSubscriptions(tenantId, keepSubscriptionId) {
        await this.supabase
            .from("billing_subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .neq("id", keepSubscriptionId);
    }
    async provisionPlanServices(tenantId, planKey) {
        if (!tenantId || !planKey)
            return;
        try {
            const sb = this.supabase;
            const { data: plan } = await sb.from("billing_plans").select("features").eq("key", planKey).maybeSingle();
            const services = (0, plan_services_1.resolvePlanServices)(planKey, plan?.features);
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
        }
        catch (e) {
            console.warn(`[billing provisioning] échec (tenant=${tenantId}, plan=${planKey}): ${e.message}`);
        }
    }
    async createPayout(tenantId, createdBy, dto) {
        const amountCents = Math.round(Number(dto?.amountCents) || 0);
        if (amountCents <= 0)
            throw new common_1.BadRequestException("amountCents (> 0) requis");
        if (!dto?.phoneNumber || !dto?.mno)
            throw new common_1.BadRequestException("phoneNumber et mno (opérateur, ex: MTN_MOMO_CMR) requis");
        const currency = (dto.currency || "XAF").toUpperCase();
        const sb = this.supabase;
        const payoutId = (0, crypto_1.randomUUID)();
        await sb.from("billing_payouts").insert({
            tenant_id: tenantId, payout_id: payoutId, provider: "pawapay", status: "pending",
            amount_cents: amountCents, currency, phone_number: dto.phoneNumber, mno: dto.mno,
            recipient_name: dto.recipientName ?? null, reason: dto.reason ?? null, created_by: createdBy,
        });
        const amount = BillingService_1.ZERO_DECIMAL.has(currency) ? String(amountCents) : (amountCents / 100).toFixed(2);
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
        }
        catch (e) {
            await sb.from("billing_payouts").update({ status: "failed", failure_message: e.message, updated_at: new Date().toISOString() }).eq("payout_id", payoutId);
            throw e;
        }
        return { payout_id: payoutId, status: initStatus, amount_cents: amountCents, currency };
    }
    async listPayouts(tenantId) {
        const { data } = await this.supabase.from("billing_payouts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        return data ?? [];
    }
    async getBalance(tenantId) {
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
            .filter((d) => String(d.pawapay_status || "").toUpperCase() === "COMPLETED")
            .reduce((s, d) => s + Number(d.amount_cents || 0), 0);
        const withdrawnCents = (pays ?? [])
            .filter((p) => !["failed", "rejected"].includes(String(p.status || "").toLowerCase()))
            .reduce((s, p) => s + Number(p.amount_cents || 0), 0);
        const availableCents = Math.max(0, collectedCents - withdrawnCents);
        return { collectedCents, withdrawnCents, availableCents, currency: "XAF" };
    }
    async applyPayoutCallback(cb) {
        if (!cb?.payoutId)
            return { received: true, matched: false };
        const sb = this.supabase;
        const { data: row } = await sb.from("billing_payouts").select("id").eq("payout_id", cb.payoutId).maybeSingle();
        if (!row)
            return { received: true, matched: false };
        const status = (cb.status || "").toUpperCase();
        const mapped = status === "COMPLETED" ? "completed" : (status === "FAILED" || status === "REJECTED") ? "failed" : status.toLowerCase() || "pending";
        await sb.from("billing_payouts").update({
            status: mapped, provider_tx_id: cb.providerTransactionId ?? null,
            failure_code: cb.failureReason?.failureCode ?? null, failure_message: cb.failureReason?.failureMessage ?? null,
            updated_at: new Date().toISOString(),
        }).eq("payout_id", cb.payoutId);
        return { received: true, matched: true, status: mapped };
    }
    async applyPawaPayDepositFromWebhook(cb) {
        if (!cb?.depositId)
            return { received: true, matched: false };
        const dep = await this.pawapay.getDepositStatus(cb.depositId).catch(() => null);
        const status = dep?.status ? String(dep.status).toUpperCase() : null;
        if (!status) {
            return { received: true, matched: false, status: "unverified" };
        }
        return this.applyPawaPayDeposit({
            depositId: cb.depositId,
            status,
            failureReason: dep?.failureReason ?? null,
        });
    }
    async applyPayoutCallbackFromWebhook(cb) {
        if (!cb?.payoutId)
            return { received: true, matched: false };
        const raw = await this.pawapay.getPayoutStatus(cb.payoutId).catch(() => null);
        const payout = raw?.data ?? raw;
        const status = payout?.status ? String(payout.status) : null;
        if (!status || status === "FOUND" || status === "NOT_FOUND") {
            return { received: true, matched: false, status: "unverified" };
        }
        return this.applyPayoutCallback({
            payoutId: cb.payoutId,
            status,
            providerTransactionId: payout?.providerTransactionId,
            failureReason: payout?.failureReason,
        });
    }
    async handleWebhook(payload, signature) {
        const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
            console.warn("[billing webhook] STRIPE_BILLING_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET absent — événement ignoré");
            return { received: true, ignored: "no_secret" };
        }
        const event = this.verifyStripeSignature(payload, signature, secret);
        if (!event)
            throw new common_1.BadRequestException("Signature Stripe invalide");
        const type = event.type;
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
        }
        catch (e) {
            console.error(`[billing webhook] échec traitement ${type}:`, e.message);
            return { received: true, type, error: e.message };
        }
        return { received: true, type };
    }
    verifyStripeSignature(payload, header, secret) {
        if (!header)
            return null;
        const parts = header.split(",").map((p) => p.trim());
        const t = parts.find((p) => p.startsWith("t="))?.slice(2);
        const v1 = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
        if (!t || v1.length === 0)
            return null;
        const ts = parseInt(t, 10);
        if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
            console.warn("[billing webhook] timestamp hors tolérance ou invalide");
            return null;
        }
        const expected = (0, crypto_1.createHmac)("sha256", secret)
            .update(`${t}.${payload.toString("utf8")}`, "utf8")
            .digest("hex");
        const expectedBuf = Buffer.from(expected, "hex");
        const ok = v1.some((sig) => {
            let buf;
            try {
                buf = Buffer.from(sig, "hex");
            }
            catch {
                return false;
            }
            return buf.length === expectedBuf.length && (0, crypto_1.timingSafeEqual)(buf, expectedBuf);
        });
        if (!ok)
            return null;
        try {
            return JSON.parse(payload.toString("utf8"));
        }
        catch {
            return null;
        }
    }
    async fetchStripeSubscription(subId) {
        if (!subId)
            return null;
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            headers: { Authorization: this.stripeAuth() },
        });
        if (!res.ok) {
            console.error(`[billing webhook] fetch subscription ${subId} → ${res.status}`);
            return null;
        }
        return res.json();
    }
    unixToIso(unix) {
        return unix ? new Date(unix * 1000).toISOString() : null;
    }
    mapStripeStatus(s) {
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
    async onCheckoutCompleted(session) {
        if (session?.mode && session.mode !== "subscription")
            return;
        const sb = this.supabase;
        const rowId = session.client_reference_id || session?.metadata?.subscription_id || null;
        const stripeSubId = session.subscription || null;
        const sub = stripeSubId ? await this.fetchStripeSubscription(stripeSubId) : null;
        const patch = {
            status: sub ? this.mapStripeStatus(sub.status) : "active",
            provider: "stripe",
            updated_at: new Date().toISOString(),
        };
        if (stripeSubId)
            patch.provider_subscription_id = stripeSubId;
        const customer = session.customer ?? sub?.customer ?? null;
        if (customer)
            patch.provider_customer_id = customer;
        if (sub?.current_period_start)
            patch.current_period_start = this.unixToIso(sub.current_period_start);
        if (sub?.current_period_end)
            patch.current_period_end = this.unixToIso(sub.current_period_end);
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
        if (patch.status === "active") {
            const { data: row } = await sb
                .from("billing_subscriptions")
                .select("id, tenant_id, plan_id, amount_cents, currency")
                .eq(matchCol, matchVal)
                .maybeSingle();
            if (row?.tenant_id) {
                await this.supersedeOtherActiveSubscriptions(row.tenant_id, row.id);
                await this.provisionPlanServices(row.tenant_id, row.plan_id);
                this.notifyTenant(row.tenant_id, "billing.subscription.activated", {
                    subscription_id: row.id,
                    plan_id: row.plan_id,
                    amount_cents: row.amount_cents,
                    currency: row.currency,
                    current_period_end: patch.current_period_end ?? null,
                });
            }
        }
    }
    async onInvoicePaid(invoice) {
        const subId = invoice.subscription;
        if (!subId)
            return;
        const sub = await this.fetchStripeSubscription(subId);
        const patch = { status: "active", updated_at: new Date().toISOString() };
        if (sub?.current_period_end)
            patch.current_period_end = this.unixToIso(sub.current_period_end);
        else if (invoice?.lines?.data?.[0]?.period?.end)
            patch.current_period_end = this.unixToIso(invoice.lines.data[0].period.end);
        await this.supabase.from("billing_subscriptions").update(patch).eq("provider_subscription_id", subId);
        const { data: row } = await this.supabase
            .from("billing_subscriptions")
            .select("id, tenant_id, plan_id")
            .eq("provider_subscription_id", subId)
            .maybeSingle();
        if (row?.tenant_id) {
            await this.supersedeOtherActiveSubscriptions(row.tenant_id, row.id);
            this.notifyTenant(row.tenant_id, "billing.invoice.paid", {
                subscription_id: row.id,
                plan_id: row.plan_id,
                amount_cents: invoice.amount_paid ?? null,
                currency: invoice.currency ?? null,
                provider_invoice_id: invoice.id ?? null,
                current_period_end: patch.current_period_end ?? null,
            });
        }
        await this.supabase
            .from("billing_invoices")
            .update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("provider_transaction_id", invoice.id);
    }
    async onInvoiceFailed(invoice) {
        const subId = invoice.subscription;
        if (!subId)
            return;
        await this.supabase
            .from("billing_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("provider_subscription_id", subId);
        const { data: row } = await this.supabase
            .from("billing_subscriptions")
            .select("id, tenant_id, plan_id")
            .eq("provider_subscription_id", subId)
            .maybeSingle();
        this.notifyTenant(row?.tenant_id, "billing.subscription.past_due", {
            subscription_id: row?.id ?? null,
            plan_id: row?.plan_id ?? null,
            amount_cents: invoice.amount_due ?? null,
            currency: invoice.currency ?? null,
            provider_invoice_id: invoice.id ?? null,
        });
    }
    async onSubscriptionUpdated(sub) {
        const patch = { status: this.mapStripeStatus(sub.status), updated_at: new Date().toISOString() };
        if (sub?.current_period_end)
            patch.current_period_end = this.unixToIso(sub.current_period_end);
        if (sub?.canceled_at)
            patch.canceled_at = this.unixToIso(sub.canceled_at);
        await this.supabase.from("billing_subscriptions").update(patch).eq("provider_subscription_id", sub.id);
    }
    async onSubscriptionCanceled(sub) {
        await this.supabase
            .from("billing_subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("provider_subscription_id", sub.id);
        const { data: row } = await this.supabase
            .from("billing_subscriptions")
            .select("id, tenant_id, plan_id")
            .eq("provider_subscription_id", sub.id)
            .maybeSingle();
        this.notifyTenant(row?.tenant_id, "billing.subscription.canceled", {
            subscription_id: row?.id ?? null,
            plan_id: row?.plan_id ?? null,
        });
    }
};
exports.BillingService = BillingService;
BillingService.PAYMENT_PROVIDERS = new Set([
    "stripe", "chariow", "cinetpay", "pawapay", "nowpayments", "paypal", "free",
]);
BillingService.ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV"]);
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        pawapay_service_1.PawaPayService,
        webhook_service_1.WebhookService,
        email_engine_service_1.EmailEngineService])
], BillingService);
//# sourceMappingURL=billing.service.js.map