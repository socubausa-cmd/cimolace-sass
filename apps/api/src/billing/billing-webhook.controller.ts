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
   * prolonge l'abonnement à la confirmation.
   *
   * SÉCURITÉ : endpoint PUBLIC — le corps n'est qu'un RÉVEIL, jamais une preuve.
   * Le statut est TOUJOURS re-lu auprès de l'API PawaPay avant toute écriture
   * (anti-forge : un payeur connaît son depositId et pouvait poster un faux
   * { status:'COMPLETED' } pour activer son abonnement sans payer).
   */
  @Post('webhook/pawapay')
  @SkipResponseWrapper()
  async pawapayWebhook(@Body() body: any) {
    // PawaPay envoie payoutId pour un retrait, depositId pour un encaissement.
    if (body?.payoutId) return this.billingService.applyPayoutCallbackFromWebhook(body);
    return this.billingService.applyPawaPayDepositFromWebhook(body);
  }
}
