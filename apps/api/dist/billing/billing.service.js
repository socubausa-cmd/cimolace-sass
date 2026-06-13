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
let BillingService = BillingService_1 = class BillingService {
    constructor(auth, pawapay) {
        this.auth = auth;
        this.pawapay = pawapay;
    }
    get supabase() { return this.auth.getClient(); }
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
        return { subscription, gating_enabled: true, plan: plan.key };
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
                const end = new Date();
                end.setMonth(end.getMonth() + 1);
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
        const { data: plan } = await sb.from("billing_plans").select("stripe_price_id, label").eq("key", sub.plan_id).maybeSingle();
        const priceId = plan?.stripe_price_id;
        if (!priceId)
            throw new common_1.BadRequestException("Aucun prix Stripe configuré pour ce plan (carte indisponible)");
        const frontend = process.env.FRONTEND_URL || "https://app.cimolace.space";
        const params = new URLSearchParams();
        params.append("mode", "subscription");
        params.append("line_items[0][price]", priceId);
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
                .select("id, tenant_id")
                .eq(matchCol, matchVal)
                .maybeSingle();
            if (row?.tenant_id)
                await this.supersedeOtherActiveSubscriptions(row.tenant_id, row.id);
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
            .select("id, tenant_id")
            .eq("provider_subscription_id", subId)
            .maybeSingle();
        if (row?.tenant_id)
            await this.supersedeOtherActiveSubscriptions(row.tenant_id, row.id);
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
    }
};
exports.BillingService = BillingService;
BillingService.ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV"]);
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService, pawapay_service_1.PawaPayService])
], BillingService);
//# sourceMappingURL=billing.service.js.map