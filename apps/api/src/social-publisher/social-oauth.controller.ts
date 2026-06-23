import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { SocialOAuthService } from './social-oauth.service';

@Controller('social-publisher/oauth')
export class SocialOAuthController {
  constructor(private readonly oauth: SocialOAuthService) {}

  /**
   * Démarrage : authentifié + tenant (header X-Tenant-Slug). Renvoie l'URL
   * d'autorisation de la plateforme, vers laquelle le front redirige.
   */
  @Get(':platform/start')
  @UseGuards(JwtAuthGuard, TenantGuard)
  start(@Param('platform') platform: string, @Req() req: any) {
    if (!this.oauth.isPlatform(platform)) {
      throw new BadRequestException('Plateforme inconnue');
    }
    return {
      url: this.oauth.getAuthorizeUrl(platform, req.tenant.id, req.user.id),
    };
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
