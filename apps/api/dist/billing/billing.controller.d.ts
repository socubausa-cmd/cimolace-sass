import { BillingService } from "./billing.service";
export declare class BillingController {
    private svc;
    constructor(svc: BillingService);
    getSubscription(req: any): Promise<{
        data: any;
    }>;
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    getInvoices(req: any): Promise<{
        data: any[];
    }>;
    plan(req: any): Promise<{
        subscriptions: any[];
        invoices: any[];
    }>;
    subscribe(req: any, b: {
        planKey?: string;
        provider?: string;
    }): Promise<{
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
    collect(req: any, id: string, b: any): Promise<{
        deposit_id: `${string}-${string}-${string}-${string}-${string}`;
        status: import("../pawapay/pawapay.types").PawaPayDepositStatus;
        invoice_number: any;
        amount: any;
        currency: any;
    }>;
    syncMobileMoney(req: any): Promise<{
        synced: {
            depositId: string;
            depositStatus?: string;
            applied?: string;
        }[];
        activated: boolean;
        failed: boolean;
    }>;
    refund(req: any, id: string): Promise<{
        refundId: `${string}-${string}-${string}-${string}-${string}`;
        status: import("../pawapay/pawapay.types").PawaPayDepositStatus;
        amount_cents: any;
        currency: string;
        depositId: string;
        invoiceId: any;
    }>;
    syncRefunds(req: any): Promise<{
        synced: {
            refundId: string;
            refundStatus?: string;
            applied?: string;
        }[];
        refunded: boolean;
        failed: boolean;
    }>;
    cardCheckout(req: any, id: string): Promise<{
        url: string;
        session_id: string;
        amount_cents: any;
        currency: any;
    }>;
    cardConfirm(req: any, id: string): Promise<{
        paid: boolean;
        status: any;
    }>;
    listPayouts(req: any): Promise<any[]>;
    balance(req: any): Promise<{
        collectedCents: number;
        withdrawnCents: number;
        availableCents: number;
        currency: string;
    }>;
    createPayout(req: any, b: any): Promise<{
        payout_id: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        amount_cents: number;
        currency: string;
    }>;
}
export declare class AdminBillingController {
    private svc;
    constructor(svc: BillingService);
    activate(tenantId: string, body: {
        plan?: string;
    }): Promise<{
        data: {
            subscription: {
                id: any;
                status: any;
                plan_id: any;
            } | null;
            gating_enabled: boolean;
            plan: any;
        };
    }>;
}
export declare class BillingCronController {
    private svc;
    constructor(svc: BillingService);
    runRenewals(key?: string): Promise<{
        scanned: number;
        initiated: number;
        skipped: number;
    }>;
}
