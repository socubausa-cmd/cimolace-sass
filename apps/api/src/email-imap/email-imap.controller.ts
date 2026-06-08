/**
 * EmailImapController
 *
 * Routes :
 *   POST /email-imap/sync       (auth admin/owner/secretariat)
 *   POST /email-imap/cron-tick  (cron secret)
 *   POST /email-imap/send       (auth staff)
 */

import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { EmailImapService } from './email-imap.service';

@Controller('email-imap')
export class EmailImapController {
  constructor(private readonly svc: EmailImapService) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async sync(
    @CurrentTenant() t: TenantContext,
    @Body() body: { maxMessages?: number; sinceDays?: number },
  ) {
    return this.svc.syncManual(t.id, body ?? {});
  }

  /** Public endpoint protégé par secret partagé (cron Netlify / scheduled). */
  @Post('cron-tick')
  async cronTick(
    @Headers('x-internal-key') internalKey?: string,
    @Headers('authorization') auth?: string,
  ) {
    const secret =
      internalKey ??
      (auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : undefined);
    return this.svc.cronTick(secret);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async send(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const userId = (req as any).user?.id ?? null;
    return this.svc.send(t.id, userId, body ?? {});
  }
}
