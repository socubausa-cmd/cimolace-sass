export declare class CheckoutService {
    createSession(data: {
        priceCents: number;
        currency: string;
        productName: string;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{
        checkoutUrl: string;
        sessionId: string;
        amount: number;
        currency: string;
    }>;
    handleWebhook(event: any): Promise<{
        received: boolean;
        type: any;
    }>;
}
