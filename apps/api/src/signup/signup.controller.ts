/**
 * POST /signup/tenant — endpoint PUBLIC (sans auth).
 * Crée un compte Cimolace + un tenant + une membership owner.
 * Utilisé par /onboarding/create?kind=liri sur le public-site.
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SignupService, type SignupTenantInput, type SignupTenantResult } from './signup.service';
import { AiBrandRateLimitGuard } from './ai-brand-rate-limit.guard';

@Controller('signup')
export class SignupController {
  constructor(private readonly svc: SignupService) {}

  @Post('tenant')
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

  /** Health check — utile pour les tests CI et préchauffer le module. */
  @Post('tenant/check-slug')
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
