import { type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../auth/current-user.decorator";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutSessionDto } from "./create-checkout-session.dto";
export declare class CheckoutController {
    private svc;
    constructor(svc: CheckoutService);
    create(dto: CreateCheckoutSessionDto, user: AuthUser): Promise<{
        checkoutUrl: string;
        sessionId: string;
    }>;
    webhook(req: RawBodyRequest<Request>, sig?: string): Promise<{
        received: boolean;
    }>;
}
