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
}
