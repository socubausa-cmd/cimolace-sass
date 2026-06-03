import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook/stripe')
  @SkipResponseWrapper()
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    await this.billingService.handleWebhook(
      req.rawBody ?? Buffer.alloc(0),
      sig,
    );
    return { received: true };
  }

  /**
   * Callback PawaPay (dépôt mobile money). Marque la facture payée/échouée et
   * prolonge l'abonnement à la confirmation. Public (appelé par pawaPay) ;
   * vérif de signature à brancher via PAWAPAY_SIGNING_SECRET.
   */
  @Post('webhook/pawapay')
  @SkipResponseWrapper()
  async pawapayWebhook(@Body() body: any) {
    return this.billingService.applyPawaPayDeposit(body);
  }
}
