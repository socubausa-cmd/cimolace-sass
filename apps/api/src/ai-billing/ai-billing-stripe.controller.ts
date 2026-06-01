/**
 * AiBillingStripeController — Webhook Stripe pour les top-up de crédits IA.
 *
 * Vérification HMAC-SHA256 manuelle (pas de dépendance Stripe SDK).
 * Format signature : "t=TIMESTAMP,v1=SIGNATURE"
 *
 * En prod : configurer STRIPE_AI_BILLING_WEBHOOK_SECRET (whsec_xxx) et créer
 * un endpoint Stripe → https://api.cimolace.space/ai-billing/stripe/webhook
 * Events : checkout.session.completed
 */

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AiBillingService } from './ai-billing.service';

interface StripeCheckoutSession {
  id: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  customer_details?: { email?: string };
  metadata?: { tenant_id?: string; pack_key?: string };
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
  created: number;
}

@Controller('ai-billing/stripe')
export class AiBillingStripeController {
  private readonly logger = new Logger(AiBillingStripeController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
  ) {
    this.webhookSecret = this.config.get<string>('STRIPE_AI_BILLING_WEBHOOK_SECRET') ?? '';
  }

  /**
   * POST /ai-billing/stripe/webhook
   * Reçoit les events Stripe signés.
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body manquant (configurer rawBody dans main.ts)');
    }

    // Vérification signature
    if (this.webhookSecret) {
      if (!signature) throw new BadRequestException('Signature Stripe absente');
      if (!this.verifyStripeSignature(rawBody, signature)) {
        this.logger.error('Signature Stripe invalide');
        throw new BadRequestException('Invalid signature');
      }
    } else {
      this.logger.warn('STRIPE_AI_BILLING_WEBHOOK_SECRET absent — vérification SKIPPED (dev only)');
    }

    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      throw new BadRequestException('Body JSON invalide');
    }

    this.logger.log(`Stripe webhook reçu : ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(event.data.object);
      default:
        return { received: true, ignored: true, type: event.type };
    }
  }

  /**
   * Vérifie la signature Stripe selon leur algo officiel :
   *   signature = HMAC_SHA256(`${timestamp}.${rawBody}`, webhookSecret)
   *   Header format : "t=TIMESTAMP,v1=SIGNATURE_HEX"
   * Tolérance : 5 minutes
   */
  private verifyStripeSignature(rawBody: Buffer, signature: string): boolean {
    const parts: Record<string, string> = {};
    for (const segment of signature.split(',')) {
      const [k, v] = segment.split('=');
      if (k && v) parts[k.trim()] = v.trim();
    }

    const timestamp = parts['t'];
    const sig = parts['v1'];
    if (!timestamp || !sig) return false;

    // Anti-replay : rejeter si > 5 min
    const tsNum = parseInt(timestamp, 10);
    if (Math.abs(Date.now() / 1000 - tsNum) > 300) {
      this.logger.warn(`Stripe webhook timestamp trop ancien (${tsNum})`);
      return false;
    }

    const payload = `${timestamp}.${rawBody.toString()}`;
    const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  private async handleCheckoutCompleted(session: StripeCheckoutSession) {
    const tenantId = session.metadata?.tenant_id;
    const packKey = session.metadata?.pack_key;

    if (!tenantId || !packKey) {
      this.logger.warn(`Checkout.completed sans metadata tenant_id/pack_key — session ${session.id}`);
      return { received: true, error: 'MISSING_METADATA' };
    }

    if (session.payment_status !== 'paid') {
      this.logger.log(`Checkout pas encore payé (${session.payment_status}) — session ${session.id}`);
      return { received: true, deferred: true };
    }

    try {
      const pack = await this.billing.getTopupPackage(packKey);
      const credits = parseFloat(pack.credits_amount);

      const result = await this.billing.creditCredits(
        tenantId,
        credits,
        'topup_purchase',
        {
          reference: session.id,
          description: `Achat ${pack.label}`,
          metadata: {
            stripe_session_id: session.id,
            pack_key: packKey,
            amount_paid_cents: session.amount_total,
            currency: session.currency,
            customer_email: session.customer_details?.email,
          },
        },
      );

      this.logger.log(
        `✅ Top-up ${credits} crédits → tenant ${tenantId} (Stripe ${session.id})`,
      );

      return { received: true, success: true, ...result };
    } catch (err) {
      this.logger.error(`Erreur credit topup: ${(err as Error).message}`);
      return { received: true, error: (err as Error).message };
    }
  }
}
