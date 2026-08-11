import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CagnotteService } from './cagnotte.service';
import {
  CreateCagnotteStripeDto,
  CreateCagnottePawapayDto,
  ConfirmStripeDto,
} from './cagnotte.dto';

/**
 * Cagnotte PUBLIQUE — AUCUN guard : les dons viennent de visiteurs anonymes de
 * prorascience.org. Europe → Stripe (carte) ; Afrique → pawaPay (Mobile Money).
 */
@Controller('cagnotte')
export class CagnotteController {
  constructor(private readonly svc: CagnotteService) {}

  // ── Studio pédagogique (financement par équipement) ──────────────────────
  // ⚠️ Routes à DEUX segments : elles ne peuvent pas entrer en collision avec
  // le motif générique `:slug` (un seul segment).

  /** Vue publique : équipements, progressions, stats, mur des contributeurs. */
  @Get('studio/overview')
  studioOverview() {
    return this.svc.studioOverview();
  }

  /** Vue admin (catalogue + contributions détaillées) — LIRI → Studio. */
  @Get('studio/admin')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  studioAdmin() {
    return this.svc.studioAdmin();
  }

  /** Sauvegarde admin : catalogue + upsert des campagnes par équipement. */
  @Put('studio/admin')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  studioAdminSave(@Body() dto: { titre?: string; intro?: string; cloturee?: boolean; equipements?: any; dejaDisponibles?: any }) {
    return this.svc.studioAdminSave(dto ?? {});
  }

  /** Campagne + total collecté (barre de progression). */
  @Get(':slug')
  campaign(@Param('slug') slug: string) {
    return this.svc.getCampaign(slug);
  }

  /** Mur des donateurs (dons confirmés) — public. */
  @Get(':slug/donors')
  donors(@Param('slug') slug: string) {
    return this.svc.listDonors(slug);
  }

  /** Opérateurs Mobile Money actifs (sélecteur pawaPay). */
  @Get(':slug/providers')
  providers(@Param('slug') _slug: string, @Query('country') country?: string) {
    return this.svc.getProviders(country);
  }

  /** Don par carte (Stripe Checkout) → { checkoutUrl } à ouvrir côté client. */
  @Post(':slug/stripe')
  @UseGuards(PublicRateLimitGuard)
  stripe(@Param('slug') slug: string, @Body() dto: CreateCagnotteStripeDto) {
    return this.svc.createStripe(slug, dto);
  }

  /** Confirmation au retour Stripe (success_url) → marque « complété » si payé. */
  @Post(':slug/stripe/confirm')
  confirm(@Param('slug') _slug: string, @Body() dto: ConfirmStripeDto) {
    return this.svc.confirmStripe(dto.sessionId);
  }

  /** Don Mobile Money (pawaPay) → { depositId, status } ; le donateur confirme sur son tél. */
  @Post(':slug/pawapay')
  @UseGuards(PublicRateLimitGuard)
  pawapay(@Param('slug') slug: string, @Body() dto: CreateCagnottePawapayDto) {
    return this.svc.createPawapay(slug, dto);
  }

  /** Poll de l'état d'un dépôt pawaPay (le front interroge jusqu'à COMPLETED/FAILED). */
  @Get(':slug/pawapay/:depositId')
  pawapayStatus(@Param('slug') _slug: string, @Param('depositId') depositId: string) {
    return this.svc.pollPawapay(depositId);
  }

  /** RELANCE QUOTIDIENNE des donateurs sans RDV — déclenchée par un cron (GitHub Actions).
   *  Aucune donnée tenant en entrée : appel machine protégé par une CLÉ partagée (CAGNOTTE_CRON_KEY). */
  @Post('cron/remind-donors')
  remindDonors(@Query('key') key?: string) {
    const expected = process.env.CAGNOTTE_CRON_KEY || '';
    if (!expected || key !== expected) throw new ForbiddenException('Clé cron invalide.');
    return this.svc.remindDonors();
  }
}
