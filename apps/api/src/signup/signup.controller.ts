/**
 * POST /signup/tenant — endpoint PUBLIC (sans auth).
 * Crée un compte Cimolace + un tenant + une membership owner.
 * Utilisé par /onboarding/create?kind=liri sur le public-site.
 */
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SignupService, type SignupTenantInput, type SignupTenantResult } from './signup.service';
import { AiBrandRateLimitGuard } from './ai-brand-rate-limit.guard';
import { SignupRateLimitGuard } from './signup-rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('signup')
export class SignupController {
  constructor(private readonly svc: SignupService) {}

  @Post('tenant')
  @UseGuards(SignupRateLimitGuard)
  async signupTenant(@Body() body: SignupTenantInput): Promise<SignupTenantResult> {
    return this.svc.signupTenant(body);
  }

  /**
   * AI Brand-in-a-box — POST /signup/ai-brand { description }
   * Génère couleurs + nom + contenu de vitrine depuis une description.
   * Génération pure (aucune écriture) ; le wizard applique ensuite.
   */
  @Post('ai-brand')
  @UseGuards(AiBrandRateLimitGuard)
  async aiBrand(@Body() body: { description?: string }) {
    return this.svc.generateBrand(body?.description ?? '');
  }

  /**
   * POST /signup/tenant-from-oauth — variante OAuth (JWT obligatoire).
   * L'user existe déjà dans Supabase Auth (Google OAuth etc.).
   * Corps : { platformName, slug?, kind?, locale?, timezone? }
   */
  @Post('tenant-from-oauth')
  @UseGuards(JwtAuthGuard)
  async signupTenantFromOAuth(
    @Req() req: any,
    @Body() body: { platformName: string; slug?: string; kind?: string; locale?: string; timezone?: string },
  ): Promise<SignupTenantResult> {
    return this.svc.signupTenantFromOAuth(req.user.id, req.user.email, {
      platformName: body.platformName,
      slug: body.slug,
      kind: body.kind ?? 'liri',
      locale: body.locale,
      timezone: body.timezone,
    });
  }

  /** Health check — utile pour les tests CI et préchauffer le module. */
  @Post('tenant/check-slug')
  @UseGuards(SignupRateLimitGuard)
  async checkSlug(@Body() body: { slug: string }) {
    if (!body?.slug) return { available: false, reason: 'slug requis' };
    // Réutilise le slugify implicite de la service via une signature minimale
    const slug = body.slug.toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
      return { available: false, reason: 'format invalide' };
    }
    // Délègue au service via une méthode interne (on garde simple ici)
    const { data } = await (this.svc as unknown as { sb: { client: any } }).sb.client
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    return { available: !data, slug };
  }
}
