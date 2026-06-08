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
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { OfferingCheckoutService } from './offering-checkout.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { CreateOfferingDepositDto } from './create-offering-deposit.dto';

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
}
