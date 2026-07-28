import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PasswordResetService } from "./password-reset.service";

/**
 * PUBLIC (sans JWT) — un utilisateur qui a perdu son mot de passe ne peut pas
 * s'authentifier pour en demander un nouveau. Contrôleur SÉPARÉ sans
 * JwtAuthGuard, sur le modèle du join invité des lives payants.
 *
 * Le tenant vient de l'en-tête `X-Tenant-Slug` (ou du corps, pour les clients
 * qui ne peuvent pas poser d'en-tête). Il détermine l'expéditeur, la marque et
 * la clé Resend utilisés — c'est tout l'intérêt de passer par ici plutôt que par
 * l'envoi intégré de Supabase.
 */
@ApiTags("Authentification — mot de passe oublié (public)")
@Controller("auth-public")
export class PasswordResetController {
  constructor(private readonly svc: PasswordResetService) {}

  @Post("password-reset")
  async request(
    @Body() body: { email?: string; redirect_to?: string; tenant?: string },
    @Headers("x-tenant-slug") slugHeader?: string,
  ) {
    const tenantSlug = String(slugHeader || body?.tenant || "").trim();
    return this.svc.request({
      email: String(body?.email ?? ""),
      tenantSlug,
      redirectTo: String(body?.redirect_to ?? ""),
    });
  }
}
