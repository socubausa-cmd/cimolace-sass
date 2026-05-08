import { CheckoutService } from "./checkout.service";
export declare class CheckoutController {
    private svc;
    constructor(svc: CheckoutService);
    create(b: any): Promise<{
        data: {
            checkoutUrl: string;
            sessionId: string;
            amount: number;
            currency: string;
        };
    }>;
    webhook(b: any): Promise<{
        data: {
            received: boolean;
            type: any;
        };
    }>;
}
