import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { BookingService } from './booking.service';
import { CreateAppointmentDto, CreateSlotDto, SetPreparationDto, SubmitFeedbackDto, UpdateAppointmentDto } from './dto/booking.dto';

@Controller('booking')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  // ── Slots ────────────────────────────────────────────────────────────────

  @Post('slots')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  createSlot(
    @Body() dto: CreateSlotDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.booking.createSlot(tenant, userId, dto);
  }

  @Get('slots')
  listSlots(
    @CurrentTenant() tenant: TenantContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.booking.listSlots(tenant.id, from, to);
  }

  // Créneaux intelligents (slotGrid + recommandations) — AVANT slots/:id.
  @Get('slots/availability')
  slotAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Query('windowStart') windowStart: string,
    @Query('windowEnd') windowEnd: string,
    @Query('timezone') timezone?: string,
    @Query('country') country?: string,
  ) {
    return this.booking.slotAvailability(tenant, { timezone, country, windowStart, windowEnd });
  }

  @Get('slots/:id')
  getSlot(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.booking.getSlot(id, tenant.id);
  }

  // ── Pont RDV → séance live (staff transforme un RDV en séance live LIRI) ──
  @Post('appointments/:id/start-live')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  startLiveFromAppointment(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.booking.startLiveFromAppointment(tenant, userId, id);
  }

  // ── Secrétaires disponibles (moteur de matching intelligent) ─────────────
  @Get('available-secretaries')
  availableSecretaries(
    @CurrentTenant() tenant: TenantContext,
    @Query('timezone') timezone?: string,
    @Query('country') country?: string,
    @Query('when') when?: string,
  ) {
    return this.booking.availableSecretaries(tenant, { timezone, country, when });
  }

  // ── Prof → séance live avec un élève (depuis le profil élève) ────────────
  @Post('students/:studentId/schedule-live')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  scheduleLiveWithStudent(
    @Param('studentId') studentId: string,
    @Body() body: { title?: string; scheduledAt?: string },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.booking.scheduleLiveWithStudent(tenant, userId, studentId, body ?? {});
  }

  // ── Préparation d'entretien (secrétariat) ────────────────────────────────
  @Get('appointments/:id/preparation')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  getPreparation(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.booking.getAppointmentPreparation(tenant, id);
  }

  @Post('appointments/:id/preparation')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  setPreparation(
    @Param('id') id: string,
    @Body() dto: SetPreparationDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.booking.setAppointmentPreparation(tenant, id, dto);
  }

  @Delete('slots/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  deleteSlot(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.booking.deleteSlot(id, tenant.id);
  }

  // ── Appointments ─────────────────────────────────────────────────────────

  @Post('appointments')
  requestAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.booking.requestAppointment(tenant, userId, dto);
  }

  // Demande de RDV SANS créneau (chat conversationnel LIRI) — le secrétariat planifie ensuite.
  // Pas de @Roles : tout membre authentifié du tenant peut faire une demande.
  @Post('appointment-request')
  requestAppointmentNoSlot(
    @Body() dto: { subject?: string; description?: string; email?: string; whatsapp?: string; preferredIso?: string },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.booking.requestAppointmentNoSlot(tenant.id, (req as any).user?.id, dto ?? {});
  }

  @Get('appointments')
  listAppointments(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const role = (req as any).tenant?.userRole;
    return this.booking.listAppointments(tenant.id, userId, role);
  }

  @Get('appointments/:id')
  getAppointment(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.booking.getAppointment(id, tenant.id);
  }

  @Patch('appointments/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher', 'secretariat')
  updateAppointment(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.booking.updateAppointment(id, tenant.id, dto);
  }

  // Annulation par le propriétaire (élève/visiteur) — pas de rôle staff,
  // la propriété du RDV est vérifiée dans le service.
  @Post('appointments/:id/cancel')
  cancelOwnAppointment(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.booking.cancelOwnAppointment(id, tenant.id, (req as any).user.id);
  }

  // ── Feedback ─────────────────────────────────────────────────────────────

  @Post('feedback')
  submitFeedback(
    @Body() dto: SubmitFeedbackDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.booking.submitFeedback(tenant.id, userId, dto);
  }

  @Get('feedback/:appointmentId')
  getFeedback(
    @Param('appointmentId') appointmentId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.booking.getFeedback(appointmentId, tenant.id);
  }
}
