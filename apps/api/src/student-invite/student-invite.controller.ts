import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StudentInviteService } from './student-invite.service';

/**
 * Codes OTP d'accès élève (L5).
 *  - POST /student-invite/send    → owner/admin/secretariat génère + envoie un code.
 *  - POST /student-invite/redeem  → PUBLIC : l'élève échange (email + code + mdp)
 *    contre son accès (compte + membership). Rate-limité par le lockout (5 essais)
 *    porté sur l'invitation elle-même.
 */
@Controller('student-invite')
export class StudentInviteController {
  constructor(private readonly svc: StudentInviteService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async send(@Req() req: any, @Body() body: { email?: string; role?: string }) {
    const invitedBy = req?.user?.email ?? req?.user?.id ?? null;
    return this.svc.generateAndSend({
      tenantId: req.tenant.id,
      email: String(body?.email ?? ''),
      role: body?.role,
      invitedBy,
    });
  }

  @Post('redeem')
  async redeem(
    @Req() _req: Request,
    @Body() body: { tenantSlug?: string; email?: string; code?: string; password?: string },
  ) {
    return this.svc.redeem({
      tenantSlug: body?.tenantSlug,
      email: String(body?.email ?? ''),
      code: String(body?.code ?? ''),
      password: String(body?.password ?? ''),
    });
  }
}
