/**
 * BookingAdvancedController — Extensions du Booking (port des 11 lambdas v1).
 *
 * Routes :
 *   GET    /booking/satisfaction/:apptId          → status enquête satisfaction
 *   POST   /booking/satisfaction/:apptId/send     → envoyer enquête
 *   POST   /booking/satisfaction/respond          → soumettre réponse (token public)
 *   POST   /booking/reminders/schedule            → programmer reminders (24h, 1h)
 *   POST   /booking/reminders/cron-tick           → tick cron (envoyer les pending)
 *   POST   /booking/reschedule/request            → demander reschedule
 *   GET    /booking/reschedule/pending            → liste demandes pending (staff)
 *   POST   /booking/reschedule/:id/decide         → staff approuve/refuse
 *   POST   /booking/invitations/send              → envoyer invitation RDV
 *   POST   /booking/invitations/respond           → token public accepter/refuser
 *   GET    /booking/appointments/:id/ics          → export ICS
 */

import {
  Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { BookingAdvancedService } from './booking-advanced.service';

@Controller('booking')
export class BookingAdvancedController {
  constructor(private readonly svc: BookingAdvancedService) {}

  // ─── Satisfaction (mix public token + auth) ──────────────────────────────

  @Get('satisfaction/:apptId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getSatisfaction(@CurrentTenant() t: TenantContext, @Param('apptId') id: string) {
    return this.svc.getSatisfactionStatus(t.id, id);
  }

  @Post('satisfaction/:apptId/send')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat', 'teacher')
  async sendSatisfaction(
    @CurrentTenant() t: TenantContext,
    @Param('apptId') id: string,
    @Body() body: { reminded?: boolean },
  ) {
    return this.svc.sendSatisfactionSurvey(t.id, id, body?.reminded ?? false);
  }

  @Post('satisfaction/respond')
  async respondSatisfaction(
    @Body() body: { token: string; rating?: number; nps_score?: number; comment?: string },
  ) {
    return this.svc.submitSatisfactionResponse(body);
  }

  // ─── Reminders ───────────────────────────────────────────────────────────

  @Post('reminders/schedule')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat', 'teacher')
  async scheduleReminders(
    @CurrentTenant() t: TenantContext,
    @Body() body: { appointment_id: string; offsets_hours?: number[]; channels?: string[] },
  ) {
    return this.svc.scheduleReminders(t.id, body);
  }

  @Post('reminders/cron-tick')
  async cronTick(@Body() body: { secret?: string }) {
    return this.svc.processPendingReminders(body?.secret);
  }

  // ─── Reschedule workflow ─────────────────────────────────────────────────

  @Post('reschedule/request')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async requestReschedule(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: {
      appointment_id: string;
      reason?: string;
      proposed_slots?: Array<{ start: string; end: string }>;
    },
  ) {
    return this.svc.requestReschedule(t.id, (req as any).user, body);
  }

  @Get('reschedule/pending')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async listPendingReschedule(@CurrentTenant() t: TenantContext) {
    return this.svc.listPendingReschedule(t.id);
  }

  @Post('reschedule/:id/decide')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat', 'teacher')
  async decideReschedule(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { decision: 'approved' | 'declined'; note?: string; new_slot_id?: string },
  ) {
    return this.svc.decideReschedule(t.id, (req as any).user?.id, id, body);
  }

  // ─── Invitations ─────────────────────────────────────────────────────────

  @Post('invitations/send')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat', 'teacher')
  async sendInvitation(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { invited_email?: string; invited_user_id?: string; slot_id?: string; channel?: string },
  ) {
    return this.svc.sendInvitation(t.id, (req as any).user?.id, body);
  }

  @Post('invitations/respond')
  async respondInvitation(
    @Body() body: { token: string; decision: 'accept' | 'decline' },
  ) {
    return this.svc.respondInvitation(body);
  }

  // ─── ICS export ──────────────────────────────────────────────────────────

  @Get('appointments/:id/ics')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async exportICS(
    @CurrentTenant() t: TenantContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const ics = await this.svc.buildICS(t.id, id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rdv-${id.slice(0, 8)}.ics"`);
    res.send(ics);
  }
}
