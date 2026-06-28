import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../auth/current-user.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SkipResponseWrapper } from "../common/decorators/skip-response-wrapper.decorator";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutSessionDto } from "./create-checkout-session.dto";

/**
 * Paiement d'un LIVE payant (Couche B : le tenant encaisse ses clients).
 * Le front (LiveJoin) POST { liveSessionId } → reçoit { checkoutUrl } à ouvrir.
 */
@Controller("checkout")
export class CheckoutController {
  constructor(private svc: CheckoutService) {}

  /** Crée la session Stripe Checkout pour rejoindre un live payant. JWT requis. */
  @Post("sessions")
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCheckoutSessionDto, @CurrentUser() user: AuthUser) {
    return this.svc.createSession(user.id, dto.liveSessionId);
  }

  /**
   * Webhook Stripe (live payant) — pas de JWT, protégé par signature `stripe-signature`.
   * rawBody activé dans main.ts. À enregistrer dans Stripe :
   * POST /checkout/webhook/stripe (event checkout.session.completed).
   */
  @Post("webhook/stripe")
  @SkipResponseWrapper()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") sig?: string,
  ) {
    return this.svc.handleStripeWebhook(req.rawBody ?? Buffer.alloc(0), sig);
  }
}
