/**
 * PublicReviewsController
 *
 * Routes :
 *   GET  /public-reviews                                  (public)
 *   POST /public-reviews                                  (public — anti-spam)
 *   POST /public-reviews/privileged-links                 (auth owner)
 *   POST /public-reviews/privileged-links/redeem          (auth — token requis)
 */

import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { PublicReviewsService } from './public-reviews.service';

@Controller('public-reviews')
export class PublicReviewsController {
  constructor(private readonly svc: PublicReviewsService) {}

  /** Public — pas d'auth */
  @Get()
  async list(@Query('limit') limit?: string, @Query('source') source?: string) {
    return this.svc.listReviews({
      limit: limit ? parseInt(limit, 10) : 9,
      source,
    });
  }

  /** Public — anti-spam */
  @Post()
  async submit(
    @Body() body: any,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') xForwardedFor?: string,
  ) {
    return this.svc.submitReview(body ?? {}, { userAgent, xForwardedFor });
  }

  /** Auth owner */
  @Post('privileged-links')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async createPrivilegedLink(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const userId = (req as any).user?.id ?? '';
    return this.svc.createPrivilegedLink(t.id, userId, t.userRole, body ?? {});
  }

  /** Auth — n'importe quel user connecté */
  @Post('privileged-links/redeem')
  @UseGuards(JwtAuthGuard)
  async redeemPrivilegedLink(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;
    return this.svc.redeemPrivilegedLink({
      slug: body?.slug,
      userId,
      userEmail,
    });
  }
}
