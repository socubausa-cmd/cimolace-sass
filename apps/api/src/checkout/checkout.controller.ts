import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutSessionDto } from './create-checkout-session.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  createSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.checkoutService.createSession(user.id, dto.liveSessionId);
  }

  /**
   * Stripe envoie le webhook sans JWT — vérification par signature HMAC.
   * rawBody: true doit être activé dans NestFactory.create (voir main.ts).
   */
  @Post('webhook/stripe')
  @SkipResponseWrapper()
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    await this.checkoutService.handleWebhook(
      req.rawBody ?? Buffer.alloc(0),
      sig,
    );
    return { received: true };
  }
}
