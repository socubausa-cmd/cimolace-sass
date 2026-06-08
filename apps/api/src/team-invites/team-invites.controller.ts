/**
 * TeamInvitesController
 *
 * Routes :
 *   POST /team-invites/send            (auth owner/admin/secretariat)
 *   POST /team-invites/:id/resend      (auth owner/admin)
 *   POST /team-invites/admin/invite    (auth owner/admin)
 */

import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { TeamInvitesService } from './team-invites.service';

@Controller('team-invites')
export class TeamInvitesController {
  constructor(private readonly svc: TeamInvitesService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async send(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const userId = (req as any).user?.id ?? '';
    return this.svc.sendInvite(t.id, userId, t.userRole, body ?? {});
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async resend(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.resendLink(t.id, t.userRole, id);
  }

  @Post('admin/invite')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async adminInvite(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.adminInvite(t.id, t.userRole, body ?? {});
  }
}
