import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SocialOAuthService } from './social-oauth.service';

@Controller('social-publisher/oauth')
export class SocialOAuthController {
  constructor(private readonly oauth: SocialOAuthService) {}

  /**
   * Démarrage : authentifié + tenant (header X-Tenant-Slug). Renvoie l'URL
   * d'autorisation de la plateforme, vers laquelle le front redirige.
   */
  @Get(':platform/start')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async start(@Param('platform') platform: string, @Req() req: any) {
    if (!this.oauth.isPlatform(platform)) {
      throw new BadRequestException('Plateforme inconnue');
    }
    return {
      url: await this.oauth.getAuthorizeUrl(
        platform,
        req.tenant.id,
        req.user.id,
      ),
    };
  }

  /** Back-office : statut des plateformes (configurée ? connectée ?). */
  @Get('status')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  status(@Req() req: any) {
    return this.oauth.getStatus(req.tenant.id);
  }

  /** Back-office : enregistrer les identifiants d'app (owner/admin uniquement). */
  @Post(':platform/config')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async saveConfig(
    @Param('platform') platform: string,
    @Req() req: any,
    @Body() body: { clientId?: string; clientSecret?: string },
  ) {
    if (!this.oauth.isPlatform(platform)) {
      throw new BadRequestException('Plateforme inconnue');
    }
    const role = String(req.tenant?.userRole || '').toLowerCase();
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }
    await this.oauth.saveConfig(
      req.tenant.id,
      platform,
      body.clientId || '',
      body.clientSecret || '',
    );
    return { ok: true };
  }

  /**
   * Callback : PUBLIC (redirigé par la plateforme, sans JWT). Le tenant est
   * porté par le `state` signé. On échange le code, on stocke le token, puis on
   * renvoie l'utilisateur vers le front.
   */
  @Get(':platform/callback')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const front =
      process.env.APP_PUBLIC_URL || 'https://prorascience.org';
    if (!this.oauth.isPlatform(platform)) {
      return res.redirect(`${front}/?social_error=plateforme_inconnue`);
    }
    try {
      await this.oauth.handleCallback(platform, code, state);
      return res.redirect(`${front}/?social_connected=${platform}`);
    } catch (e) {
      return res.redirect(
        `${front}/?social_error=${encodeURIComponent((e as Error).message)}`,
      );
    }
  }
}
