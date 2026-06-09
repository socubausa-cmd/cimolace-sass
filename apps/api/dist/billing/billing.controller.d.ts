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
    collect(req: any, id: string, b: any): Promise<{
        deposit_id: `${string}-${string}-${string}-${string}-${string}`;
        status: import("../pawapay/pawapay.types").PawaPayDepositStatus;
        invoice_number: any;
        amount: any;
        currency: any;
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
    createPayout(req: any, b: any): Promise<{
        payout_id: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        amount_cents: number;
        currency: string;
    }>;
}
