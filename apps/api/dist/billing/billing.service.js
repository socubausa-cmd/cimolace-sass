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
const usage_service_1 = require("../usage/usage.service");
const plan_services_1 = require("./plan-services");
let BillingService = BillingService_1 = class BillingService {
    constructor(auth, pawapay, tenantWebhooks, email, usage) {
        this.auth = auth;
        this.pawapay = pawapay;
        this.tenantWebhooks = tenantWebhooks;
        this.email = email;
        this.usage = usage;
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
    async envoyerEmailTenant(tenantId, destinataire, sujet, corpsHtml) {
        if (!destinataire)
            return;
        try {
            const sb = this.supabase;
            const { data: reglages } = tenantId
                ? await sb
                    .from("tenant_notification_settings")
                    .select("email_from, email_from_name")
                    .eq("tenant_id", tenantId)
                    .maybeSingle()
                : { data: null };
            await sb.from("email_queue").insert({
                tenant_id: tenantId ?? null,
                to: destinataire,
                from: reglages?.email_from ?? null,
                from_name: reglages?.email_from_name ?? null,
                subject: sujet,
                html_body: corpsHtml,
                status: "pending",
            });
        }
        catch (e) {
            this.logger.warn(`[billing email] mise en file échouée (${destinataire}): ${e.message}`);
        }
    }
    async alerterCimolace(sujet, corpsHtml) {
        const adresse = (process.env.CIMOLACE_BILLING_ALERT_EMAIL || "").trim();
        if (!adresse) {
            this.logger.warn(`[billing email] CIMOLACE_BILLING_ALERT_EMAIL non défini — alerte exploitant NON envoyée : « ${sujet} »`);
            return;
        }
        await this.envoyerEmailTenant(null, adresse, sujet, corpsHtml);
    }
    static montantLisible(cents, devise) {
        if (cents == null)
            return "";
        return `${(Number(cents) / 100).toFixed(2).replace(".", ",")} ${String(devise || "EUR").toUpperCase()}`;
    }
    async nomTenant(tenantId) {
        try {
            const { data } = await this.supabase
                .from("tenants")
                .select("name, slug")
                .eq("id", tenantId)
                .maybeSingle();
            return data?.name || data?.slug || tenantId;
        }
        catch {
            return tenantId;
        }
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
    async activateTenantSubscription(tenantId, planKey, actor) {
        if (!planKey)
            throw new common_1.BadRequestException("planKey requis (aucun forfait par défaut — neutralité §1).");
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
        try {
            await sb.from("cimolace_change_history").insert({
                action: "billing:activate",
                entity_type: "tenant",
                entity_id: tenantId,
                description: `Forfait ${plan.key} activé + gating armé`,
                changed_by: (actor && actor.trim()) || "Cimolace Ops (non attribué)",
            });
        }
        catch {
        }
        return { subscription, gating_enabled: true, plan: plan.key };
    }
    async createPaymentLinkForTenant(tenantId, planKey, actor, cycle) {
        const sb = this.supabase;
        let subscriptionId;
        let planUsed = planKey;
        if (planKey && planKey.trim()) {
            const r = await this.subscribeToPlan(tenantId, planKey.trim(), "stripe");
            subscriptionId = r.subscription_id;
        }
        else {
            const { data: subs } = await sb
                .from("billing_subscriptions")
                .select("id, plan_id, status, created_at")
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false })
                .limit(10);
            const rows = Array.isArray(subs) ? subs : [];
            const rank = (s) => (["active", "trialing", "past_due", "unpaid", "pending"].includes(String(s)) ? 1 : 0);
            const primary = rows.sort((a, b) => rank(b.status) - rank(a.status))[0];
            if (!primary) {
                throw new common_1.BadRequestException("Aucun abonnement pour ce tenant — précisez un planKey (clé billing_plans).");
            }
            subscriptionId = primary.id;
            planUsed = primary.plan_id;
        }
        const checkout = await this.createCardCheckout(tenantId, subscriptionId, cycle);
        try {
            await sb.from("cimolace_change_history").insert({
                action: "billing:payment-link",
                entity_type: "tenant",
                entity_id: tenantId,
                description: `Lien de paiement Stripe généré (plan ${planUsed ?? "?"}${cycle ? `, cycle ${cycle}` : ""})`,
                changed_by: (actor && actor.trim()) || "Cimolace Ops (non attribué)",
            });
        }
        catch {
        }
        return {
            url: checkout.url,
            session_id: checkout.session_id,
            subscription_id: subscriptionId,
            plan: planUsed ?? null,
            amount_cents: checkout.amount_cents ?? null,
            currency: checkout.currency ?? null,
        };
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
            if (inv.status === "paid")
                return { received: true, matched: true, status: "already_paid" };
            await sb.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", inv.id);
            if (inv.subscription_id) {
                const start = new Date();
                const payMethod = inv.metadata?.payer_phone
                    ? { type: "mobile_money", provider: inv.metadata.payer_provider ?? null, phone: inv.metadata.payer_phone }
                    : null;
                const { data: subRow } = await sb.from("billing_subscriptions").select("metadata, user_id, tenant_id, plan_id").eq("id", inv.subscription_id).maybeSingle();
                const end = BillingService_1.addCycle(start, await this.planBillingCycle(subRow?.plan_id));
                await sb.from("billing_subscriptions").update({
                    status: "active",
                    current_period_start: start.toISOString(),
                    current_period_end: end.toISOString(),
                    metadata: { ...(subRow?.metadata ?? {}), ...(payMethod ? { payment_method: payMethod } : {}) },
                    updated_at: new Date().toISOString(),
                }).eq("id", inv.subscription_id);
                const tid = subRow?.tenant_id;
                if (tid) {
                    await this.supersedeOtherActiveSubscriptions(tid, inv.subscription_id);
                    await this.provisionPlanServices(tid, subRow?.plan_id);
                }
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
            if (sub?.metadata?.cancel_at_period_end) {
                skipped++;
                continue;
            }
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
    async createCardCheckout(tenantId, subscriptionId, cycleOverride) {
        const auth = this.stripeAuth();
        const sb = this.supabase;
        const { data: sub } = await sb.from("billing_subscriptions").select("*").eq("id", subscriptionId).eq("tenant_id", tenantId).maybeSingle();
        if (!sub)
            throw new common_1.NotFoundException("Abonnement introuvable");
        const { data: plan } = await sb
            .from("billing_plans")
            .select("stripe_price_id, label, price_cents, currency, billing_cycle, metadata")
            .eq("key", sub.plan_id)
            .maybeSingle();
        const planCycle = String(plan?.billing_cycle ?? "monthly").toLowerCase();
        const cycle = BillingService_1.normalizeCycle(cycleOverride) ?? planCycle;
        const cycled = cycle !== planCycle && ["quarterly", "yearly"].includes(cycle);
        let priceId = plan?.stripe_price_id;
        let amountCents = Number(plan?.price_cents ?? sub?.amount_cents ?? 0);
        let appliedDisc = 0;
        if (cycled && planCycle === "monthly" && amountCents > 0) {
            const disc = BillingService_1.cycleDiscount(plan?.metadata, cycle);
            appliedDisc = disc;
            const months = cycle === "yearly" ? 12 : 3;
            amountCents = Math.round(amountCents * months * (1 - disc));
            priceId = null;
            await sb.from("billing_subscriptions").update({
                amount_cents: amountCents,
                metadata: { ...(sub.metadata ?? {}), cycle_override: cycle },
                updated_at: new Date().toISOString(),
            }).eq("id", subscriptionId);
        }
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
            const iv = BillingService_1.cycleToStripeInterval(cycle);
            params.append("line_items[0][price_data][currency]", currency);
            params.append("line_items[0][price_data][unit_amount]", String(amountCents));
            params.append("line_items[0][price_data][recurring][interval]", iv.interval);
            if (iv.count > 1)
                params.append("line_items[0][price_data][recurring][interval_count]", String(iv.count));
            const discPct = appliedDisc > 0 ? ` (−${Math.round(appliedDisc * 100)} %)` : "";
            const cycleLabel = cycle === "yearly" ? ` — Annuel${discPct}` : cycle === "quarterly" ? ` — Trimestriel${discPct}` : "";
            params.append("line_items[0][price_data][product_data][name]", String(plan?.label ?? sub?.plan_id ?? "Abonnement Cimolace") + cycleLabel);
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
            const start = new Date();
            const chosenCycle = BillingService_1.normalizeCycle(sub?.metadata?.cycle_override) ??
                (await this.planBillingCycle(sub.plan_id));
            const end = BillingService_1.addCycle(start, chosenCycle);
            await sb.from("billing_subscriptions").update({ status: "active", provider_subscription_id: s.subscription ?? null, provider_customer_id: s.customer ?? null, current_period_start: start.toISOString(), current_period_end: end.toISOString(), updated_at: new Date().toISOString() }).eq("id", subscriptionId);
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
    static addCycle(from, cycle) {
        const c = String(cycle ?? "monthly").toLowerCase();
        const d = new Date(from);
        if (c === "yearly")
            d.setFullYear(d.getFullYear() + 1);
        else if (c === "quarterly")
            d.setMonth(d.getMonth() + 3);
        else if (c === "weekly")
            d.setDate(d.getDate() + 7);
        else if (c === "one_time" || c === "lifetime")
            d.setFullYear(d.getFullYear() + 100);
        else
            d.setMonth(d.getMonth() + 1);
        return d;
    }
    static normalizeCycle(c) {
        const v = String(c ?? "").trim().toLowerCase();
        return ["monthly", "quarterly", "yearly"].includes(v) ? v : undefined;
    }
    static cycleDiscount(planMeta, cycle) {
        const defaults = { quarterly: 0.10, yearly: 0.20 };
        const raw = planMeta?.cycle_discounts?.[cycle];
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0 && n <= 0.5)
            return n;
        return defaults[cycle] ?? 0;
    }
    static cycleToStripeInterval(cycle) {
        switch (String(cycle ?? "monthly").toLowerCase()) {
            case "yearly": return { interval: "year", count: 1 };
            case "quarterly": return { interval: "month", count: 3 };
            case "weekly": return { interval: "week", count: 1 };
            default: return { interval: "month", count: 1 };
        }
    }
    async planBillingCycle(planKey) {
        if (!planKey)
            return "monthly";
        const { data } = await this.supabase
            .from("billing_plans").select("billing_cycle").eq("key", planKey).maybeSingle();
        return String(data?.billing_cycle ?? "monthly").toLowerCase();
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
    static categoryToKind(category) {
        const c = String(category || "").toLowerCase();
        if (c.includes("medos"))
            return "medos";
        if (c.includes("ecole") || c.includes("school"))
            return "school";
        if (c.includes("bienetre") || c.includes("wellness"))
            return "wellness";
        if (c.includes("createur") || c.includes("creator"))
            return "creator";
        if (c.includes("mbolo") || c.includes("commerce"))
            return "mbolo";
        return "liri";
    }
    static hostingModeForOffer(offerTier) {
        const o = String(offerTier || "hosted").toLowerCase();
        if (o === "integration")
            return "embedded";
        if (o === "customized")
            return "customized";
        return "hosted";
    }
    static slugify(s) {
        let base = String(s || "")
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
            .slice(0, 38) || "tenant";
        if (base.length < 2)
            base = `${base}-t`;
        if (BillingService_1.RESERVED_SLUGS.has(base))
            base = `${base}-org`;
        return base;
    }
    async provisionUserByEmail(email, firstName, lastName) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key)
            throw new common_1.BadRequestException("Supabase non configuré (acquisition).");
        const em = email.trim().toLowerCase();
        const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
        const findId = async () => {
            const r = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(em)}`, { headers });
            if (!r.ok)
                return undefined;
            const d = (await r.json());
            return (d?.users || []).find((u) => u.email?.toLowerCase() === em)?.id;
        };
        const existing = await findId();
        if (existing)
            return { id: existing, isNew: false };
        const createRes = await fetch(`${url}/auth/v1/admin/users`, {
            method: "POST", headers,
            body: JSON.stringify({ email: em, email_confirm: true, user_metadata: { first_name: firstName ?? null, last_name: lastName ?? null, role: "owner", created_via: "acquisition" } }),
        });
        if (createRes.ok)
            return { id: (await createRes.json()).id, isNew: true };
        const raced = await findId();
        if (!raced)
            throw new common_1.BadRequestException("Provisionnement du compte impossible.");
        return { id: raced, isNew: false };
    }
    async generateAuthLink(email, type, redirectTo) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key)
            return null;
        try {
            const r = await fetch(`${url}/auth/v1/admin/generate_link`, {
                method: "POST",
                headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ type, email: email.trim().toLowerCase(), options: { redirect_to: redirectTo } }),
            });
            if (!r.ok)
                return null;
            const d = (await r.json());
            return d?.action_link || d?.properties?.action_link || null;
        }
        catch {
            return null;
        }
    }
    async sendAcquisitionWelcome(tenantId, email, orgName, userIsNew) {
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
            this.logger.log(`[acquisition] email d'accès → ${email} (${res?.status ?? "?"}, magic=${!!magic}, recover=${!!recover})`);
        }
        catch (e) {
            this.logger.warn(`[acquisition] email d'accès non envoyé à ${email}: ${e.message}`);
        }
    }
    async insertTenantForPurchase(p) {
        const sb = this.supabase;
        for (let attempt = 0; attempt < 5; attempt++) {
            const slug = attempt === 0 ? p.baseSlug : `${p.baseSlug}-${attempt + 1}`;
            const { data, error } = await sb.from("tenants").insert({
                name: p.name, slug, owner_user_id: p.ownerUserId, infrastructure_type: p.kind,
                status: "active", plan: "free", billing_status: "free", locale: p.locale, timezone: p.timezone,
                metadata: { hosting_mode: p.hostingMode, created_via: "acquisition", billing: { enforce_caps: true } },
            }).select("id").single();
            if (!error && data)
                return data.id;
            const code = error?.code;
            const msg = String(error?.message || "").toLowerCase();
            if (code === "23505" || /duplicate|unique|already exists/.test(msg))
                continue;
            throw new common_1.BadRequestException(`Création du tenant échouée: ${error?.message ?? "inconnue"}`);
        }
        throw new common_1.BadRequestException("Impossible de générer un slug unique (5 tentatives).");
    }
    async createTenantFromPurchase(p) {
        const sb = this.supabase;
        const email = String(p.email || "").trim().toLowerCase();
        if (!email)
            throw new common_1.BadRequestException("email requis pour provisionner l'achat");
        if (!p.planKey)
            throw new common_1.BadRequestException("planKey requis");
        if (p.providerRef) {
            const { data: seen } = await sb.from("billing_subscriptions")
                .select("id, tenant_id, user_id").eq("provider_checkout_id", p.providerRef).maybeSingle();
            if (seen?.tenant_id) {
                return { tenantId: seen.tenant_id, userId: seen.user_id, subscriptionId: seen.id, created: false };
            }
        }
        const { data: plan } = await sb.from("billing_plans")
            .select("key, billing_cycle, category, offer_tier, price_cents, currency").eq("key", p.planKey).maybeSingle();
        if (!plan)
            throw new common_1.NotFoundException(`Plan « ${p.planKey} » introuvable`);
        const offerTier = String(plan.offer_tier ?? "hosted").toLowerCase();
        const kind = BillingService_1.categoryToKind(plan.category);
        const hostingMode = BillingService_1.hostingModeForOffer(offerTier);
        const { id: userId, isNew: userIsNew } = await this.provisionUserByEmail(email, p.firstName, p.lastName);
        let tenantId;
        let created = false;
        if (p.intent === "existing" && p.existingTenantId) {
            const { data: t } = await sb.from("tenants").select("id, owner_user_id").eq("id", p.existingTenantId).maybeSingle();
            if (!t)
                throw new common_1.NotFoundException("Tenant cible introuvable");
            const { data: mem } = await sb.from("tenant_memberships")
                .select("role").eq("tenant_id", p.existingTenantId).eq("user_id", userId).maybeSingle();
            const owner = t.owner_user_id === userId || ["owner", "admin"].includes(String(mem?.role || ""));
            if (!owner)
                throw new common_1.BadRequestException("Rattachement refusé : vous n'êtes pas propriétaire de ce tenant");
            tenantId = t.id;
        }
        else {
            const baseSlug = BillingService_1.slugify(p.slug || p.orgName || email.split("@")[0]);
            tenantId = await this.insertTenantForPurchase({
                name: p.orgName || baseSlug, baseSlug, ownerUserId: userId, kind, hostingMode,
                locale: p.locale ?? "fr", timezone: p.timezone ?? "Europe/Paris",
            });
            created = true;
        }
        await sb.from("tenant_memberships").upsert({ tenant_id: tenantId, user_id: userId, role: "owner", status: "active" }, { onConflict: "tenant_id,user_id" });
        await this.provisionPlanServices(tenantId, p.planKey);
        const start = new Date();
        const end = BillingService_1.addCycle(start, String(plan.billing_cycle));
        const { data: sub, error: subErr } = await sb.from("billing_subscriptions").insert({
            tenant_id: tenantId, user_id: userId, plan_id: p.planKey, status: "active",
            provider: "stripe",
            provider_checkout_id: p.providerRef ?? null,
            provider_subscription_id: p.stripeSubscriptionId ?? null,
            provider_customer_id: p.stripeCustomerId ?? null,
            amount_cents: Number(plan.price_cents ?? 0),
            currency: String(plan.currency ?? "EUR"),
            current_period_start: start.toISOString(), current_period_end: end.toISOString(),
            metadata: { offer_tier: offerTier, acquisition: true },
        }).select("id").maybeSingle();
        if (subErr) {
            if (created) {
                await sb.from("tenant_services").delete().eq("tenant_id", tenantId);
                await sb.from("tenant_memberships").delete().eq("tenant_id", tenantId);
                await sb.from("tenants").delete().eq("id", tenantId);
            }
            throw new common_1.InternalServerErrorException(`Abonnement d'acquisition non enregistré: ${subErr.message}`);
        }
        await this.supersedeOtherActiveSubscriptions(tenantId, sub?.id);
        if (created && p.intent !== "existing") {
            await this.sendAcquisitionWelcome(tenantId, email, p.orgName || "", userIsNew);
        }
        this.logger.log(`[acquisition] tenant ${created ? "créé" : "rattaché"} ${tenantId} (plan=${p.planKey}, offre=${offerTier}, kind=${kind}) pour ${email}`);
        return { tenantId, userId, subscriptionId: sub?.id ?? null, created };
    }
    async createAcquisitionCheckout(dto) {
        const auth = this.stripeAuth();
        const sb = this.supabase;
        const email = String(dto?.email || "").trim().toLowerCase();
        if (!email || !/.+@.+\..+/.test(email))
            throw new common_1.BadRequestException("Email valide requis");
        if (!dto?.planKey)
            throw new common_1.BadRequestException("planKey requis");
        const intent = dto.intent === "existing" ? "existing" : "new_tenant";
        if (intent === "new_tenant" && !dto.orgName)
            throw new common_1.BadRequestException("Le nom de l'organisation est requis");
        if (intent === "existing" && !dto.existingTenantId)
            throw new common_1.BadRequestException("existingTenantId requis pour rattacher");
        const { data: plan } = await sb.from("billing_plans")
            .select("key, stripe_price_id, label, price_cents, currency, billing_cycle, offer_tier, is_active, features")
            .eq("key", dto.planKey).maybeSingle();
        if (!plan || plan.is_active === false)
            throw new common_1.NotFoundException("Offre inconnue ou inactive");
        const priceId = plan.stripe_price_id;
        const amountCents = Number(plan.price_cents ?? 0);
        if (!priceId && amountCents <= 0)
            throw new common_1.BadRequestException("Aucun prix carte configuré pour ce plan");
        if (!(0, plan_services_1.resolvePlanServices)(dto.planKey, plan.features).length) {
            throw new common_1.BadRequestException("Ce plan n'active aucun produit — souscription bloquée");
        }
        const offerTier = String(plan.offer_tier ?? "hosted").toLowerCase();
        const frontend = process.env.FRONTEND_URL || "https://app.cimolace.space";
        const params = new URLSearchParams();
        params.append("mode", "subscription");
        if (priceId) {
            params.append("line_items[0][price]", priceId);
        }
        else {
            const currency = String(plan.currency ?? "EUR").toLowerCase();
            const { interval, count } = BillingService_1.cycleToStripeInterval(plan.billing_cycle);
            params.append("line_items[0][price_data][currency]", currency);
            params.append("line_items[0][price_data][unit_amount]", String(amountCents));
            params.append("line_items[0][price_data][recurring][interval]", interval);
            params.append("line_items[0][price_data][recurring][interval_count]", String(count));
            params.append("line_items[0][price_data][product_data][name]", String(plan.label ?? dto.planKey));
        }
        params.append("line_items[0][quantity]", "1");
        params.append("success_url", `${frontend}/creer-organisation/succes?session_id={CHECKOUT_SESSION_ID}`);
        params.append("cancel_url", `${frontend}/creer-organisation?annule=1`);
        params.append("customer_email", email);
        params.append("metadata[intent]", intent);
        params.append("metadata[plan_key]", dto.planKey);
        params.append("metadata[offer_tier]", offerTier);
        params.append("metadata[org_email]", email);
        if (dto.orgName)
            params.append("metadata[org_name]", dto.orgName);
        if (dto.slug)
            params.append("metadata[org_slug]", dto.slug);
        if (dto.existingTenantId)
            params.append("metadata[existing_tenant_id]", dto.existingTenantId);
        params.append("subscription_data[metadata][intent]", intent);
        params.append("subscription_data[metadata][plan_key]", dto.planKey);
        params.append("subscription_data[metadata][offer_tier]", offerTier);
        const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        if (!res.ok)
            throw new common_1.BadRequestException(`Stripe checkout ${res.status}: ${await res.text()}`);
        const s = (await res.json());
        if (!s.url)
            throw new common_1.BadRequestException("Session Stripe créée sans URL");
        return { url: s.url };
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
        }
        catch (e) {
            console.error(`[billing webhook] échec traitement ${type}:`, e.message);
            throw e;
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
    static invoiceSubscriptionId(invoice) {
        const line0 = invoice?.lines?.data?.[0] ?? {};
        return (invoice?.subscription ??
            invoice?.parent?.subscription_details?.subscription ??
            line0?.parent?.subscription_item_details?.subscription ??
            line0?.subscription ??
            null);
    }
    static subscriptionPeriod(sub) {
        const item0 = sub?.items?.data?.[0] ?? {};
        return {
            start: sub?.current_period_start ?? item0?.current_period_start ?? null,
            end: sub?.current_period_end ?? item0?.current_period_end ?? null,
        };
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
    async claimWebhookEvent(eventId) {
        const { error } = await this.supabase.from("billing_webhook_events").insert({ event_id: eventId });
        if (!error)
            return true;
        if (error.code === "23505")
            return false;
        this.logger.warn(`[webhook dedup] claim échec (${eventId}): ${error.message}`);
        return true;
    }
    async releaseWebhookEvent(eventId) {
        try {
            await this.supabase.from("billing_webhook_events").delete().eq("event_id", eventId);
        }
        catch (e) {
            this.logger.warn(`[webhook dedup] release échec (${eventId}): ${e.message}`);
        }
    }
    async onCheckoutCompleted(session, eventId) {
        if (session?.mode === "payment" && session?.metadata?.credit_pack) {
            if (eventId && !(await this.claimWebhookEvent(eventId))) {
                this.logger.log(`[packs] event ${eventId} déjà traité — ignoré`);
                return;
            }
            const paid = session.payment_status === "paid" || session.status === "complete";
            if (!paid) {
                this.logger.warn(`[packs] session ${session.id} non payée (${session.payment_status}) — ignorée`);
                if (eventId)
                    await this.releaseWebhookEvent(eventId);
                return;
            }
            try {
                await this.usage.applyPackFromCheckout(session.metadata, session.id);
            }
            catch (e) {
                if (eventId)
                    await this.releaseWebhookEvent(eventId);
                throw e;
            }
            return;
        }
        if (session?.mode && session.mode !== "subscription")
            return;
        const sb = this.supabase;
        const meta = session?.metadata ?? {};
        if (meta.intent === "new_tenant" || meta.intent === "existing") {
            if (eventId && !(await this.claimWebhookEvent(eventId))) {
                this.logger.log(`[acquisition] event ${eventId} déjà traité — ignoré`);
                return;
            }
            const paid = session.payment_status === "paid" || session.status === "complete";
            if (!paid) {
                this.logger.warn(`[acquisition] session ${session.id} non payée (payment_status=${session.payment_status}) — ignorée`);
                if (eventId)
                    await this.releaseWebhookEvent(eventId);
                return;
            }
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
            }
            catch (e) {
                if (eventId)
                    await this.releaseWebhookEvent(eventId);
                throw e;
            }
            return;
        }
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
        const periode = BillingService_1.subscriptionPeriod(sub);
        if (periode.start)
            patch.current_period_start = this.unixToIso(periode.start);
        if (periode.end)
            patch.current_period_end = this.unixToIso(periode.end);
        const matchCol = rowId ? "id" : "provider_checkout_id";
        const matchVal = rowId || session.id;
        const { data: updatedRows, error: updErr } = await sb.from("billing_subscriptions").update(patch).eq(matchCol, matchVal).select("id");
        if (updErr) {
            this.logger.error(`[billing webhook] échec UPDATE abo (session=${session.id}): ${updErr.message}`);
            throw new common_1.InternalServerErrorException(updErr.message);
        }
        if (!updatedRows || updatedRows.length === 0) {
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
                const emailClient = session.customer_details?.email || session.customer_email || null;
                const montant = BillingService_1.montantLisible(row.amount_cents, row.currency);
                const echeance = patch.current_period_end
                    ? new Date(patch.current_period_end).toLocaleDateString("fr-FR")
                    : null;
                const espace = `${(process.env.FRONTEND_URL || "https://app.cimolace.space").replace(/\/$/, "")}/cimolace/billing`;
                const nom = await this.nomTenant(row.tenant_id);
                await this.envoyerEmailTenant(row.tenant_id, emailClient, "Votre abonnement Cimolace est actif", `<h2>Merci, votre abonnement est actif</h2>` +
                    `<p>Nous avons bien reçu votre paiement${montant ? ` de <strong>${montant}</strong>` : ""}.</p>` +
                    `<p>Votre abonnement est reconduit <strong>automatiquement</strong>${echeance ? `, prochain prélèvement le <strong>${echeance}</strong>` : ""}. Vous pouvez l'arrêter à tout moment depuis votre espace.</p>` +
                    `<p style="margin:18px 0"><a href="${espace}" style="background:#d97757;color:#1f1e1c;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Voir ma facturation</a></p>`);
                await this.alerterCimolace(`Encaissement — ${nom}${montant ? ` — ${montant}` : ""}`, `<h2>Nouvel abonnement actif</h2>` +
                    `<p><strong>${nom}</strong> vient de souscrire « ${row.plan_id} »${montant ? ` à <strong>${montant}</strong>` : ""}.</p>` +
                    `<p>Payeur : ${emailClient ?? "inconnu"}<br>` +
                    `Prochaine échéance : ${echeance ?? "non renseignée"}<br>` +
                    `Abonnement Stripe : ${stripeSubId ?? "aucun"}</p>`);
            }
        }
    }
    async onInvoicePaid(invoice) {
        const subId = BillingService_1.invoiceSubscriptionId(invoice);
        if (!subId) {
            this.logger.warn(`[billing webhook] invoice.paid sans id d'abonnement (facture=${invoice?.id ?? "?"}) — renouvellement NON enregistré`);
            return;
        }
        const sub = await this.fetchStripeSubscription(subId);
        const patch = { status: "active", updated_at: new Date().toISOString() };
        const fin = BillingService_1.subscriptionPeriod(sub).end;
        if (fin)
            patch.current_period_end = this.unixToIso(fin);
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
            if (invoice?.billing_reason !== "subscription_create") {
                const montant = BillingService_1.montantLisible(invoice.amount_paid, invoice.currency);
                const echeance = patch.current_period_end
                    ? new Date(patch.current_period_end).toLocaleDateString("fr-FR")
                    : null;
                const nom = await this.nomTenant(row.tenant_id);
                const emailClient = invoice.customer_email || null;
                await this.envoyerEmailTenant(row.tenant_id, emailClient, "Votre abonnement Cimolace a été renouvelé", `<h2>Renouvellement confirmé</h2>` +
                    `<p>Votre abonnement a été renouvelé${montant ? ` pour <strong>${montant}</strong>` : ""}.</p>` +
                    `<p>${echeance ? `Prochain prélèvement le <strong>${echeance}</strong>.` : "Il se poursuit automatiquement."}</p>`);
                await this.alerterCimolace(`Renouvellement — ${nom}${montant ? ` — ${montant}` : ""}`, `<h2>Abonnement renouvelé</h2>` +
                    `<p><strong>${nom}</strong> — « ${row.plan_id} »${montant ? `, <strong>${montant}</strong>` : ""} encaissés.</p>` +
                    `<p>Prochaine échéance : ${echeance ?? "non renseignée"}<br>Facture Stripe : ${invoice.id ?? "?"}</p>`);
            }
        }
        await this.supabase
            .from("billing_invoices")
            .update({ status: "paid", provider: "stripe", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("provider_transaction_id", invoice.id);
    }
    async onInvoiceFailed(invoice) {
        const subId = BillingService_1.invoiceSubscriptionId(invoice);
        if (!subId) {
            this.logger.warn(`[billing webhook] invoice.payment_failed sans id d'abonnement (facture=${invoice?.id ?? "?"}) — impayé NON enregistré`);
            return;
        }
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
        const montantDu = BillingService_1.montantLisible(invoice.amount_due, invoice.currency);
        const nomDefaillant = row?.tenant_id ? await this.nomTenant(row.tenant_id) : "tenant inconnu";
        const espaceFact = `${(process.env.FRONTEND_URL || "https://app.cimolace.space").replace(/\/$/, "")}/cimolace/billing`;
        await this.envoyerEmailTenant(row?.tenant_id ?? null, invoice.customer_email || null, "Votre paiement Cimolace n'a pas abouti", `<h2>Le prélèvement a été refusé</h2>` +
            `<p>Votre banque a refusé le prélèvement${montantDu ? ` de <strong>${montantDu}</strong>` : ""}. Votre accès reste ouvert pour le moment.</p>` +
            `<p>Pour éviter toute interruption, mettez votre moyen de paiement à jour depuis votre espace.</p>` +
            `<p style="margin:18px 0"><a href="${espaceFact}" style="background:#d97757;color:#1f1e1c;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Mettre à jour ma carte</a></p>`);
        await this.alerterCimolace(`IMPAYÉ — ${nomDefaillant}${montantDu ? ` — ${montantDu}` : ""}`, `<h2>Prélèvement refusé</h2>` +
            `<p><strong>${nomDefaillant}</strong> est passé en <strong>past_due</strong>${montantDu ? ` (${montantDu} dus)` : ""}.</p>` +
            `<p>Client : ${invoice.customer_email ?? "inconnu"}<br>` +
            `Abonnement Stripe : ${subId}<br>` +
            `Facture : ${invoice.id ?? "?"}</p>` +
            `<p>Le service n'est pas coupé : la fenêtre de grâce court 7 jours après l'échéance.</p>`);
    }
    async onSubscriptionUpdated(sub) {
        const patch = { status: this.mapStripeStatus(sub.status), updated_at: new Date().toISOString() };
        const finPeriode = BillingService_1.subscriptionPeriod(sub).end;
        if (finPeriode)
            patch.current_period_end = this.unixToIso(finPeriode);
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
BillingService.RESERVED_SLUGS = new Set([
    "admin", "api", "app", "www", "cimolace", "liri", "login", "logout", "static",
    "assets", "public", "dashboard", "billing", "webhook", "medos", "mbolo", "isna",
    "support", "help", "new", "creer-organisation", "t", "auth", "signup",
]);
BillingService.ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV"]);
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        pawapay_service_1.PawaPayService,
        webhook_service_1.WebhookService,
        email_engine_service_1.EmailEngineService,
        usage_service_1.UsageService])
], BillingService);
//# sourceMappingURL=billing.service.js.map