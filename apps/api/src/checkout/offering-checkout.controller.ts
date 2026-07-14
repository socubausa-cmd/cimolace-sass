import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { OfferingCheckoutService } from './offering-checkout.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { CreateOfferingDepositDto } from './create-offering-deposit.dto';
import { CreateOfferingCardDto } from './create-offering-card.dto';

/**
 * Paiement Mobile Money (pawaPay) des offres PRORASCIENCE / Ngowazulu :
 * abonnement mentorat (récurrent app-driven), consultation, offrande.
 */
@Controller('offering-checkout')
export class OfferingCheckoutController {
  constructor(
    private readonly svc: OfferingCheckoutService,
    private readonly renewals: SubscriptionRenewalService,
  ) {}

  @Post('mobile-money')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateOfferingDepositDto, @CurrentUser() user: AuthUser) {
    return this.svc.createMobileMoneyDeposit(user.id, dto);
  }

  /** Paiement CARTE (Stripe Checkout) — renvoie { checkoutUrl } à ouvrir côté client. */
  @Post('card')
  @UseGuards(JwtAuthGuard)
  card(@Body() dto: CreateOfferingCardDto, @CurrentUser() user: AuthUser) {
    return this.svc.createStripeCheckout(user.id, dto, user.email);
  }

  /** Paiement PAYPAL — crée un ordre (Orders v2), renvoie { orderId, approveUrl }. */
  @Post('paypal/create-order')
  @UseGuards(JwtAuthGuard)
  paypalCreate(@Body() dto: CreateOfferingCardDto, @CurrentUser() user: AuthUser) {
    return this.svc.createPaypalOrder(user.id, dto);
  }

  /** Capture d'un ordre PayPal approuvé (scopé à l'utilisateur) → fulfillment. */
  @Post('paypal/capture')
  @UseGuards(JwtAuthGuard)
  paypalCapture(@Body() body: { orderId?: string }, @CurrentUser() user: AuthUser) {
    return this.svc.capturePaypalOrder(user.id, String(body?.orderId ?? ''));
  }

  /** Accès GRATUIT (service free/community) : débloque sans paiement. Vérifié côté serveur. */
  @Post('claim-free')
  @UseGuards(JwtAuthGuard)
  claimFree(@Body() body: { planSlug?: string }, @CurrentUser() user: AuthUser) {
    return this.svc.claimFree(user.id, body?.planSlug);
  }

  // ── INVITÉ (sans compte) : provisionne un compte par email, puis flux normal ──
  /** Paiement CARTE invité → provisionne + checkout Stripe. Public (email requis). */
  @Post('guest-card')
  guestCard(
    @Body() body: CreateOfferingCardDto & { email: string; first_name?: string; last_name?: string },
  ) {
    return this.svc.guestStripeCheckout(body);
  }

  /**
   * Déblocage d'accès APRÈS un paiement encaissé par le TENANT sur SON propre
   * Stripe (paiement natif hors tunnel Cimolace — ex : masterclass réglée sur le
   * site du tenant). Authentifié par CLÉ TENANT (cml_) : le tenant = celui de la
   * clé (jamais du corps). Le tenant vérifie le paiement (webhook Stripe signé) AVANT.
   */
  @Post('tenant-grant')
  @UseGuards(ApiKeyGuard)
  tenantGrant(
    @Req() req: any,
    @Body()
    body: { planSlug?: string; email?: string; first_name?: string; last_name?: string; payment_ref?: string },
  ) {
    return this.svc.tenantGrantServiceAccess(req.tenant.id, body);
  }

  /** Dépôt Mobile Money invité → provisionne + dépôt PawaPay. Public (email requis). */
  @Post('guest-mobile-money')
  guestMobileMoney(
    @Body() body: CreateOfferingDepositDto & { email: string; first_name?: string; last_name?: string },
  ) {
    return this.svc.guestMobileMoney(body);
  }

  /** Ordre PayPal invité → provisionne + ordre. Public (email requis). */
  @Post('guest-paypal/create-order')
  guestPaypal(
    @Body() body: CreateOfferingCardDto & { email: string; first_name?: string; last_name?: string },
  ) {
    return this.svc.guestPaypal(body);
  }

  /** Accès GRATUIT invité → provisionne + réclame. Public (email requis). */
  @Post('guest-claim-free')
  guestClaimFree(
    @Body() body: { planSlug?: string; tenantSlug?: string; email: string; first_name?: string; last_name?: string },
  ) {
    return this.svc.guestClaimFree(body);
  }

  @Get('mobile-money/:depositId/status')
  @UseGuards(JwtAuthGuard)
  status(@Param('depositId') depositId: string, @CurrentUser() user: AuthUser) {
    return this.svc.getStatus(depositId, user.id);
  }

  /** Opérateurs Mobile Money disponibles (ex: ?country=CMR). Public. */
  @Get('providers')
  providers(@Query('country') country?: string) {
    return this.svc.getProviders(country);
  }

  /**
   * Webhook pawaPay — pas de JWT, protégé par signature HMAC.
   * rawBody: true est activé dans main.ts. Sur COMPLETED d'un dépôt
   * kind=subscription, l'abonnement mensuel est créé/prolongé.
   * À enregistrer dans le dashboard pawaPay : POST /offering-checkout/webhook/pawapay
   */
  @Post('webhook/pawapay')
  @SkipResponseWrapper()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pawapay-signature') sig?: string,
  ) {
    await this.renewals.handlePawaPayCallback(req.rawBody ?? Buffer.alloc(0), sig);
    return { received: true };
  }

  /**
   * Webhook Stripe (offres élève) — pas de JWT, protégé par signature `stripe-signature`.
   * rawBody: true activé dans main.ts. À enregistrer dans le dashboard Stripe :
   * POST /offering-checkout/webhook/stripe (events: checkout.session.completed, invoice.paid).
   */
  @Post('webhook/stripe')
  @SkipResponseWrapper()
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig?: string,
  ) {
    await this.renewals.handleStripeOfferingWebhook(req.rawBody ?? Buffer.alloc(0), sig);
    return { received: true };
  }

  /**
   * Déclencheur du planificateur de renouvellement (cron externe).
   * Protégé par l'en-tête x-internal-key == process.env.INTERNAL_CRON_KEY.
   * Relance un dépôt Mobile Money pour chaque abonnement PawaPay échu.
   */
  @Post('renewals/run')
  runRenewals(@Headers('x-internal-key') key?: string) {
    const expected = process.env.INTERNAL_CRON_KEY;
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Clé interne invalide');
    }
    return this.renewals.processDueRenewals();
  }

  /**
   * Poll manuel des dépôts offering en attente (substitut du callback PawaPay, qui pointe
   * sur un autre tenant). Le poller in-process tourne déjà toutes les 60 s ; cet endpoint
   * permet un déclenchement à la demande / via cron externe. Protégé par clé interne.
   */
  @Post('poll-pending')
  pollPending(@Headers('x-internal-key') key?: string) {
    const expected = process.env.INTERNAL_CRON_KEY;
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Clé interne invalide');
    }
    return this.renewals.pollPendingOfferingDeposits();
  }
}
