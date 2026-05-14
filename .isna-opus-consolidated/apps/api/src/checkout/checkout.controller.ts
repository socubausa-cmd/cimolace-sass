import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutSessionDto } from './create-checkout-session.dto';
import { CreatePawaPaySessionDto } from './create-pawapay-session.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // STRIPE
  // ─────────────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────────────
  // PAWAPAY — Mobile Money (CMR, RWA, GHA, CIV, …)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initie un dépôt Mobile Money via pawaPay.
   * Retourne { depositId, status: 'ACCEPTED' }.
   * Le frontend doit ensuite poller GET /checkout/sessions/pawapay/:depositId/status
   * ou attendre le callback webhook pour connaître le résultat final.
   */
  @Post('sessions/pawapay')
  @UseGuards(JwtAuthGuard)
  createPawaPaySession(
    @Body() dto: CreatePawaPaySessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.checkoutService.createPawaPaySession(
      user.id,
      dto.liveSessionId,
      dto.phoneNumber,
      dto.provider,
      dto.country,
    );
  }

  /**
   * Polling du statut d'un dépôt pawaPay.
   * Utile pendant le délai d'attente de confirmation PIN Mobile Money.
   */
  @Get('sessions/pawapay/:depositId/status')
  @UseGuards(JwtAuthGuard)
  getPawaPayStatus(
    @Param('depositId') depositId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.checkoutService.pollPawaPayStatus(depositId, user.id);
  }

  /**
   * Providers Mobile Money disponibles via pawaPay.
   * Filtrable par pays ISO3 (ex: ?country=CMR).
   * Utilisé par le frontend pour afficher les opérateurs disponibles.
   */
  @Get('pawapay/providers')
  getPawaPayProviders(@Query('country') country?: string) {
    return this.checkoutService.getPawaPayProviders(country);
  }

  /**
   * Webhook pawaPay — pas de JWT, protection par signature HMAC-SHA256.
   * Configurer l'URL de callback dans le dashboard pawaPay :
   * https://dashboard.pawapay.io → Settings → Callbacks
   *
   * rawBody: true doit être activé dans NestFactory.create (voir main.ts).
   */
  @Post('webhook/pawapay')
  @SkipResponseWrapper()
  async pawaPayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pawapay-signature') sig: string | undefined,
  ) {
    await this.checkoutService.handlePawaPayCallback(
      req.rawBody ?? Buffer.alloc(0),
      sig,
    );
    return { received: true };
  }
}
