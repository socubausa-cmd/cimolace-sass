import { AuthService } from "../auth/auth.service";
import { PawaPayService } from "../pawapay/pawapay.service";
export declare class BillingService {
    private auth;
    private pawapay;
    constructor(auth: AuthService, pawapay: PawaPayService);
    private get supabase();
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
