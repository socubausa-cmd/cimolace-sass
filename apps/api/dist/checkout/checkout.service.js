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
var CheckoutService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const tenant_payment_config_service_1 = require("../billing/tenant-payment-config/tenant-payment-config.service");
const stripe_rest_util_1 = require("../billing/stripe-rest.util");
let CheckoutService = CheckoutService_1 = class CheckoutService {
    constructor(auth, tenantPayments) {
        this.auth = auth;
        this.tenantPayments = tenantPayments;
        this.logger = new common_1.Logger(CheckoutService_1.name);
    }
    get db() {
        return this.auth.getClient();
    }
    async createSession(userId, liveSessionId) {
        const { data: live } = await this.db
            .from("live_sessions")
            .select("id, tenant_id, price_cents, currency, title, status")
            .eq("id", liveSessionId)
            .maybeSingle();
        if (!live)
            throw new common_1.NotFoundException("Live introuvable.");
        const priceCents = Number(live.price_cents ?? 0);
        if (!(priceCents > 0)) {
            throw new common_1.BadRequestException("Ce live est gratuit — aucun paiement requis.");
        }
        const tenantId = live.tenant_id;
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
            throw new common_1.BadRequestException("Vous avez déjà accès à ce live.");
        }
        const tenantStripe = await this.tenantPayments.resolveTenantProviderCreds(tenantId, "stripe");
        const tenantStripeKey = tenantStripe?.creds?.secret_key || null;
        if (!tenantStripeKey && !(0, stripe_rest_util_1.isStripeConfigured)()) {
            throw new common_1.ServiceUnavailableException("Paiement carte indisponible : aucune clé Stripe (ni tenant, ni plateforme).");
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
        params.append("metadata[kind]", "live_session");
        params.append("metadata[user_id]", userId);
        params.append("metadata[tenant_id]", tenantId);
        params.append("metadata[live_session_id]", liveSessionId);
        let session;
        try {
            session = await (0, stripe_rest_util_1.stripeCreateCheckoutSession)(params, tenantStripeKey ?? undefined);
        }
        catch (e) {
            this.logger.error("Stripe createCheckoutSession (live)", e.message);
            throw new common_1.ServiceUnavailableException(`Impossible de créer la session de paiement : ${e.message}`);
        }
        return { checkoutUrl: session.url, sessionId: session.id };
    }
    async handleStripeWebhook(rawBody, signature) {
        let peekTenantId = null;
        try {
            const peek = JSON.parse((rawBody ?? Buffer.alloc(0)).toString("utf8"));
            peekTenantId = peek?.data?.object?.metadata?.tenant_id ?? null;
        }
        catch {
        }
        const candidates = [];
        if (peekTenantId) {
            const tp = await this.tenantPayments.resolveTenantProviderCreds(peekTenantId, "stripe");
            if (tp?.creds?.webhook_secret)
                candidates.push(tp.creds.webhook_secret);
        }
        for (const s of [
            process.env.STRIPE_LIVE_WEBHOOK_SECRET,
            process.env.STRIPE_WEBHOOK_SECRET,
            process.env.STRIPE_BILLING_WEBHOOK_SECRET,
        ]) {
            if (s)
                candidates.push(s);
        }
        if (candidates.length === 0) {
            this.logger.warn("Webhook Stripe live : aucun secret (tenant ni env) — ignoré.");
            return { received: true };
        }
        let event = null;
        for (const secret of candidates) {
            event = (0, stripe_rest_util_1.verifyStripeSignature)(rawBody ?? Buffer.alloc(0), signature, secret);
            if (event)
                break;
        }
        if (!event)
            throw new common_1.BadRequestException("Signature Stripe invalide.");
        const paidTypes = new Set([
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        ]);
        if (paidTypes.has(event.type)) {
            const s = event.data?.object ?? {};
            const meta = s.metadata ?? {};
            const isPaid = event.type === "checkout.session.async_payment_succeeded" ||
                s.payment_status === "paid";
            if (meta.kind === "live_session" &&
                meta.user_id &&
                meta.tenant_id &&
                meta.live_session_id &&
                isPaid) {
                await this.db.from("access_passes").upsert({
                    tenant_id: meta.tenant_id,
                    user_id: meta.user_id,
                    resource_type: "live_session",
                    resource_id: meta.live_session_id,
                    payment_id: s.payment_intent ?? s.id ?? null,
                    status: "active",
                }, { onConflict: "tenant_id,user_id,resource_type,resource_id" });
                await this.db.from("tenant_memberships").upsert({
                    tenant_id: meta.tenant_id,
                    user_id: meta.user_id,
                    role: "student",
                    status: "active",
                }, { onConflict: "tenant_id,user_id", ignoreDuplicates: true });
                this.logger.log(`Live payant : accès accordé user=${meta.user_id} live=${meta.live_session_id}`);
            }
        }
        return { received: true };
    }
};
exports.CheckoutService = CheckoutService;
exports.CheckoutService = CheckoutService = CheckoutService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        tenant_payment_config_service_1.TenantPaymentConfigService])
], CheckoutService);
//# sourceMappingURL=checkout.service.js.map