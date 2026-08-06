import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { BoutiqueService } from './boutique.service';
import {
  AccompanimentRequestDto,
  BuyPawapayDto,
  BuyStripeDto,
  ConfirmStripeDto,
  ResendLinkDto,
  SubmitReviewDto,
} from './boutique.dto';

/**
 * Boutique numérique PUBLIQUE — AUCUN guard d'authentification : les acheteuses
 * sont des visiteuses anonymes de prorascience.org. Les routes qui écrivent ou
 * envoient un e-mail passent par le rate-limit public.
 */
@Controller('boutique')
export class BoutiqueController {
  constructor(private readonly svc: BoutiqueService) {}

  // ── Produit ──────────────────────────────────────────────────────────────

  @Get('produits/:slug')
  product(@Param('slug') slug: string) {
    return this.svc.getProduct(slug);
  }

  /** Opérateurs Mobile Money actifs (sélecteur pawaPay). */
  @Get('produits/:slug/providers')
  providers(@Param('slug') _slug: string, @Query('country') country?: string) {
    return this.svc.getProviders(country);
  }

  // ── Avis ─────────────────────────────────────────────────────────────────

  @Get('produits/:slug/avis')
  reviews(@Param('slug') slug: string, @Query('limit') limit?: string) {
    return this.svc.listReviews(slug, limit ? parseInt(limit, 10) : 24);
  }

  @Post('produits/:slug/avis')
  @UseGuards(PublicRateLimitGuard)
  submitReview(@Param('slug') slug: string, @Body() dto: SubmitReviewDto) {
    return this.svc.submitReview(slug, dto);
  }

  // ── Achat ────────────────────────────────────────────────────────────────

  /** Carte (Stripe Checkout) → { checkoutUrl } à ouvrir côté client. */
  @Post('produits/:slug/stripe')
  @UseGuards(PublicRateLimitGuard)
  stripe(@Param('slug') slug: string, @Body() dto: BuyStripeDto) {
    return this.svc.createStripe(slug, dto);
  }

  /** Retour Stripe (success_url) → { status, downloadUrl } si le paiement est passé. */
  @Post('produits/:slug/stripe/confirm')
  confirm(@Param('slug') _slug: string, @Body() dto: ConfirmStripeDto) {
    return this.svc.confirmStripe(dto.sessionId);
  }

  /** Mobile Money (pawaPay) → l'acheteuse confirme sur son téléphone. */
  @Post('produits/:slug/pawapay')
  @UseGuards(PublicRateLimitGuard)
  pawapay(@Param('slug') slug: string, @Body() dto: BuyPawapayDto) {
    return this.svc.createPawapay(slug, dto);
  }

  /** Poll du dépôt ; renvoie le lien de téléchargement dès qu'il est confirmé. */
  @Get('produits/:slug/pawapay/:depositId')
  pawapayStatus(@Param('slug') _slug: string, @Param('depositId') depositId: string) {
    return this.svc.pollPawapay(depositId);
  }

  /** Lien perdu → renvoi par e-mail (réponse identique que l'achat existe ou non). */
  @Post('produits/:slug/renvoyer-lien')
  @UseGuards(PublicRateLimitGuard)
  resend(@Param('slug') slug: string, @Body() dto: ResendLinkDto) {
    return this.svc.resendLink(slug, dto.email);
  }

  // ── Téléchargement ───────────────────────────────────────────────────────

  /**
   * Sert le PDF filigrané. `@Res()` sans passthrough ⇒ on écrit la réponse
   * nous-mêmes ; l'intercepteur d'enveloppe est explicitement neutralisé.
   */
  @Get('telecharger/:token')
  @SkipResponseWrapper()
  @Header('Cache-Control', 'no-store, private')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async download(@Param('token') token: string, @Res() res: Response) {
    const { buffer, filename } = await this.svc.download(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  // ── Accompagnement ───────────────────────────────────────────────────────

  @Get('accompagnement/:slug')
  program(@Param('slug') slug: string) {
    return this.svc.getProgram(slug);
  }

  @Post('accompagnement/:slug/demande')
  @UseGuards(PublicRateLimitGuard)
  request(@Param('slug') slug: string, @Body() dto: AccompanimentRequestDto) {
    return this.svc.createRequest(slug, dto);
  }
}
