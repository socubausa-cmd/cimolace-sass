import { AuthService } from "../auth/auth.service";
export declare class BillingService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    getSubscription(tenantId: string): Promise<any>;
    createSubscription(tenantId: string, plan: string, provider: string): Promise<any>;
    getInvoices(tenantId: string): Promise<any[]>;
    handleWebhook(payload: Buffer, signature: string): Promise<{
        received: boolean;
    }>;
}
