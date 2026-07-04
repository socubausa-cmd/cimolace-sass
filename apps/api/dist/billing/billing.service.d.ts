import { OnApplicationBootstrap } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PawaPayService } from "../pawapay/pawapay.service";
import { WebhookService } from "../liri-public/webhook.service";
import { EmailEngineService } from "../email-engine/email-engine.service";
export declare class BillingService implements OnApplicationBootstrap {
    private auth;
    private pawapay;
    private tenantWebhooks;
    private email;
    private readonly logger;
    constructor(auth: AuthService, pawapay: PawaPayService, tenantWebhooks: WebhookService, email: EmailEngineService);
    private get supabase();
    onApplicationBootstrap(): void;
    private notifyTenant;
    getSubscription(tenantId: string): Promise<any>;
    createSubscription(tenantId: string, plan: string, provider: string): Promise<any>;
    getInvoices(tenantId: string): Promise<any[]>;
    getTenantSubscription(tenantId: string): Promise<{
        subscriptions: any[];
        invoices: any[];
    }>;
    activateTenantSubscription(tenantId: string, planKey?: string): Promise<{
        subscription: {
            id: any;
            status: any;
            plan_id: any;
        } | null;
        gating_enabled: boolean;
        plan: any;
    }>;
    private static readonly PAYMENT_PROVIDERS;
    subscribeToPlan(tenantId: string, planKey: string, provider?: string): Promise<{
        subscription_id: string;
        invoice_id: string | null;
        plan: {
            key: string;
            label: any;
            price_cents: number;
            currency: string;
        };
        status: string;
    }>;
    collectSubscriptionViaPawaPay(tenantId: string, subscriptionId: string, dto: {
        phoneNumber?: string;
        provider?: string;
        country?: string;
    }): Promise<{
        deposit_id: `${string}-${string}-${string}-${string}-${string}`;
        status: import("../pawapay/pawapay.types").PawaPayDepositStatus;
        invoice_number: any;
        amount: any;
        currency: any;
    }>;
    applyPawaPayDeposit(cb: {
        depositId?: string;
        status?: string;
        failureReason?: unknown;
    }): Promise<{
        received: boolean;
        matched: boolean;
        status?: undefined;
    } | {
        received: boolean;
        matched: boolean;
        status: string | undefined;
    }>;
    private sendPaymentReceiptEmail;
    syncPendingPawaPayDeposits(tenantId: string): Promise<{
        synced: {
            depositId: string;
            depositStatus?: string;
            applied?: string;
        }[];
        activated: boolean;
        failed: boolean;
    }>;
    refundSubscriptionPayment(tenantId: string, subscriptionId: string): Promise<{
        refundId: `${string}-${string}-${string}-${string}-${string}`;
        status: import("../pawapay/pawapay.types").PawaPayDepositStatus;
        amount_cents: any;
        currency: string;
        depositId: string;
        invoiceId: any;
    }>;
    syncPendingRefunds(tenantId: string): Promise<{
        synced: {
            refundId: string;
            refundStatus?: string;
            applied?: string;
        }[];
        refunded: boolean;
        failed: boolean;
    }>;
    renewDueSubscriptions(limit?: number): Promise<{
        scanned: number;
        initiated: number;
        skipped: number;
    }>;
    private stripeAuth;
    createCardCheckout(tenantId: string, subscriptionId: string): Promise<{
        url: string;
        session_id: string;
        amount_cents: any;
        currency: any;
    }>;
    confirmCardPayment(tenantId: string, subscriptionId: string): Promise<{
        paid: boolean;
        status: any;
    }>;
    private supersedeOtherActiveSubscriptions;
    private provisionPlanServices;
    private static ZERO_DECIMAL;
    createPayout(tenantId: string, createdBy: string | null, dto: {
        amountCents?: number;
        currency?: string;
        phoneNumber?: string;
        mno?: string;
        recipientName?: string;
        reason?: string;
    }): Promise<{
        payout_id: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        amount_cents: number;
        currency: string;
    }>;
    listPayouts(tenantId: string): Promise<any[]>;
    getBalance(tenantId: string): Promise<{
        collectedCents: number;
        withdrawnCents: number;
        availableCents: number;
        currency: string;
    }>;
    applyPayoutCallback(cb: {
        payoutId?: string;
        status?: string;
        providerTransactionId?: string;
        failureReason?: {
            failureCode?: string;
            failureMessage?: string;
        };
    }): Promise<{
        received: boolean;
        matched: boolean;
        status?: undefined;
    } | {
        received: boolean;
        matched: boolean;
        status: string;
    }>;
    applyPawaPayDepositFromWebhook(cb: {
        depositId?: string;
    }): Promise<{
        received: boolean;
        matched: boolean;
        status?: undefined;
    } | {
        received: boolean;
        matched: boolean;
        status: string | undefined;
    }>;
    applyPayoutCallbackFromWebhook(cb: {
        payoutId?: string;
    }): Promise<{
        received: boolean;
        matched: boolean;
        status?: undefined;
    } | {
        received: boolean;
        matched: boolean;
        status: string;
    }>;
    handleWebhook(payload: Buffer, signature: string): Promise<{
        received: boolean;
        ignored: string;
        type?: undefined;
        error?: undefined;
    } | {
        received: boolean;
        type: string;
        error: string;
        ignored?: undefined;
    } | {
        received: boolean;
        type: "checkout.session.completed" | "invoice.paid" | "invoice.payment_succeeded" | "invoice.payment_failed" | "customer.subscription.updated" | "customer.subscription.deleted";
        ignored?: undefined;
        error?: undefined;
    }>;
    private verifyStripeSignature;
    private fetchStripeSubscription;
    private unixToIso;
    private mapStripeStatus;
    private onCheckoutCompleted;
    private onInvoicePaid;
    private onInvoiceFailed;
    private onSubscriptionUpdated;
    private onSubscriptionCanceled;
}
