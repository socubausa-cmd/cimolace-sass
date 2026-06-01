import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LiveEmbedService } from './live-embed.service';
import { LiveEmbedTokenGuard } from './live-embed-token.guard';
import type { LiveEmbedTokenPayload } from './live-embed.types';

type EmbedRequest = Request & { embedPayload?: LiveEmbedTokenPayload };

/**
 * Endpoints publics pour le système d'embed LIRI Live.
 * Ces routes ne nécessitent pas de session Supabase — elles sont conçues
 * pour être appelées depuis un widget JS sur un site externe.
 *
 * Flow :
 *   1. Widget JS appelle POST /lives/embed/token (Origin vérifié)
 *   2. Widget crée une iframe vers /embed/live/:sessionId?et=TOKEN
 *   3. L'iframe appelle POST /lives/embed/:sessionId/join (embed token validé)
 *   4. L'iframe connecte via LiveKit avec le token retourné
 */
@ApiTags('LIRI Embed')
@Controller('lives/embed')
export class LiveEmbedController {
  constructor(private readonly svc: LiveEmbedService) {}

  // ─── Route 1 : émettre un embed token ──────────────────────────────────────

  /**
   * POST /lives/embed/token
   * Appelé par le widget JS sur le site client.
   * L'Origin header est vérifié contre la whitelist tenant_domains.
   * Retourne un embed_token JWT (30 min) + l'iframe_url prête à l'emploi.
   */
  @Post('token')
  @ApiOperation({
    summary: 'Émettre un embed token pour une session live',
    description: 'Appelé par le widget JS. L\'Origin est vérifiée contre tenant_domains.',
  })
  async issueToken(
    @Req() req: Request,
    @Body() body: { tenant: string; session: string; role?: 'viewer' | 'co_host' },
  ) {
    const origin = req.headers['origin'] as string | undefined;
    return this.svc.issueEmbedToken({
      tenantSlug: body.tenant,
      sessionId: body.session,
      origin,
      role: body.role ?? 'viewer',
    });
  }

  // ─── Route 2 : infos publiques de la session ────────────────────────────────

  /**
   * GET /lives/embed/:sessionId/info?tenant=xxx
   * Retourne les métadonnées publiques d'une session (titre, statut, heure).
   * Pas d'auth requise — pour l'affichage avant de rejoindre.
   */
  @Get(':sessionId/info')
  @ApiOperation({ summary: 'Métadonnées publiques de la session (sans auth)' })
  async getInfo(
    @Param('sessionId') sessionId: string,
    @Query('tenant') tenant: string,
  ) {
    return this.svc.getSessionInfo(tenant, sessionId);
  }

  // ─── Route 3 : rejoindre la session (embed token → LiveKit token) ───────────

  /**
   * POST /lives/embed/:sessionId/join
   * Protégé par LiveEmbedTokenGuard.
   * Valide l'embed token et retourne un token LiveKit participant.
   * Appelé par la page iframe lors de son montage.
   */
  @Post(':sessionId/join')
  @UseGuards(LiveEmbedTokenGuard)
  @ApiOperation({
    summary: 'Rejoindre la session (échange embed token → LiveKit token)',
  })
  async joinSession(
    @Req() req: EmbedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.svc.joinSession(req.embedPayload!, sessionId);
  }
}
