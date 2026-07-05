import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LiveJoinService } from './live-join.service';

/**
 * Liens de live configurables (scénario A).
 *  - POST   /live-join/:sessionId/codes         (auth animateur/admin) → générer
 *  - GET    /live-join/:sessionId/codes          (auth) → lister
 *  - DELETE /live-join/:sessionId/codes/:codeId  (auth) → révoquer
 *  - POST   /live-join/redeem                     (PUBLIC) → token viewer LiveKit
 */
@Controller('live-join')
export class LiveJoinController {
  constructor(private readonly svc: LiveJoinService) {}

  @Post(':sessionId/codes')
  @UseGuards(JwtAuthGuard)
  generate(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { mode?: 'class' | 'individual'; count?: number; students?: string[]; expiresAt?: string | null },
  ) {
    return this.svc.generate(req.user.id, sessionId, body ?? {});
  }

  @Get(':sessionId/codes')
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.svc.list(req.user.id, sessionId);
  }

  @Delete(':sessionId/codes/:codeId')
  @UseGuards(JwtAuthGuard)
  revoke(@Req() req: any, @Param('sessionId') sessionId: string, @Param('codeId') codeId: string) {
    return this.svc.revoke(req.user.id, sessionId, codeId);
  }

  /** PUBLIC — l'élève échange un code contre un accès à la salle (token viewer). */
  @Post('redeem')
  redeem(@Body() body: { code?: string; displayName?: string }) {
    return this.svc.redeem({ code: String(body?.code ?? ''), displayName: body?.displayName });
  }
}
