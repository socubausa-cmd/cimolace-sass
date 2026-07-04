import { AuthService } from "../auth/auth.service";
import { TenantPaymentConfigService } from "../billing/tenant-payment-config/tenant-payment-config.service";
export declare class CheckoutService {
    private readonly auth;
    private readonly tenantPayments;
    private readonly logger;
    constructor(auth: AuthService, tenantPayments: TenantPaymentConfigService);
    private get db();
    createSession(userId: string, liveSessionId: string): Promise<{
        checkoutUrl: string;
        sessionId: string;
    }>;
    handleStripeWebhook(rawBody: Buffer, signature?: string): Promise<{
        received: boolean;
    }>;
}
