import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { TenantApiKeyService } from '../tenant/tenant-api-key.service';
import { TenantTokenDto } from './tenant-token.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantApiKeyService: TenantApiKeyService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    // Objet NU : ResponseInterceptor l'enveloppe une seule fois → { data: {...} }.
    // (Auparavant on renvoyait déjà { data: ... } → double-wrap { data: { data } }.)
    return this.authService.resolveCimolaceIdentity(req.user);
  }

  /**
   * Pont tenant externe → MedOS JWT.
   * Zahir (ou tout client externe) envoie sa clé API + contexte utilisateur,
   * reçoit un JWT MedOS valable 15 min pour appeler les endpoints MedOS.
   *
   * POST /auth/tenant-token
   * Body: { apiKey, userId, email, role }
   * Retourne: { token, expiresAt, tenantSlug }
   */
  @Post('tenant-token')
  @HttpCode(200)
  async tenantToken(@Body() dto: TenantTokenDto) {
    const keyData = await this.tenantApiKeyService.validateKey(dto.apiKey);
    if (!keyData) {
      throw new UnauthorizedException('Clé API invalide ou révoquée');
    }

    // SÉCURITÉ : le rôle est plafonné au rôle RÉEL de l'utilisateur dans le tenant
    // (jamais celui — potentiellement forgé — envoyé dans le body). Cf resolveCappedMedosRole.
    const effectiveRole = await this.authService.resolveCappedMedosRole(
      keyData.tenantId,
      dto.userId,
      dto.role,
    );

    const token = this.authService.generateMedosToken({
      sub: dto.userId,
      email: dto.email,
      role: effectiveRole,
      tenant_id: keyData.tenantId,
      tenant_slug: keyData.tenantSlug,
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      token,
      expiresAt,
      tenantSlug: keyData.tenantSlug,
      role: effectiveRole,
    };
  }
}
