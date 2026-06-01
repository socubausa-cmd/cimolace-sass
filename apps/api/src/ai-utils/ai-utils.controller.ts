/**
 * AiUtilsController — endpoints REST pour les utilitaires IA.
 *
 * Routes (toutes auth JWT + tenant) :
 *   POST /ai-utils/ad-copy/generate
 *   POST /ai-utils/annual-program/generate
 *   POST /ai-utils/reformulate
 *   POST /ai-utils/post-call/report
 */

import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { AiUtilsService } from './ai-utils.service';

@Controller('ai-utils')
export class AiUtilsController {
  constructor(private readonly svc: AiUtilsService) {}

  @Post('ad-copy/generate')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async adCopy(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.generateAdCopy(t.id, body ?? {});
  }

  @Post('annual-program/generate')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async annualProgram(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.generateAnnualProgram(t.id, body ?? {});
  }

  @Post('reformulate')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async reformulate(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.reformulate(t.id, body ?? {});
  }

  @Post('post-call/report')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async postCallReport(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const userId = (req as any).user?.id ?? null;
    return this.svc.postCallReport(t.id, userId, body ?? {});
  }
}
