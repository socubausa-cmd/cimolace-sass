import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosService } from '../medos.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { MessagingService } from '../messaging/messaging.service';
import { TeleconsultService } from '../teleconsult/teleconsult.service';
import { EmbedTokenGuard, RequireEmbedScope } from './embed-token.guard';

type EmbedRequest = Request & {
  user?: { id: string };
  tenant?: TenantContext;
};

/**
 * Endpoints data spécifiques pour le widget embed (Mode C.1) et l'iframe
 * embarquée (Mode C.2).
 *
 * Ces routes sont protégées par EmbedTokenGuard (et non JwtAuthGuard) — elles
 * acceptent UNIQUEMENT le JWT embed-token court délivré par
 * POST /v1/medos/embed/token. Le tenant est résolu depuis le payload du
 * token, pas depuis le header X-Tenant-Slug.
 *
 * Pour les patients déjà authentifiés via Supabase auth (cookie / JWT
 * normal), utiliser les routes /med/me/* du MedosPatientMeController.
 */
@ApiTags('MedOS — Embed Data')
@Controller('v1/medos/embed')
@UseGuards(EmbedTokenGuard)
export class MedosEmbedDataController {
  constructor(
    private readonly medosService: MedosService,
    private readonly prescriptions: PrescriptionsService,
    private readonly appointments: AppointmentsService,
    private readonly messaging: MessagingService,
    private readonly teleconsult: TeleconsultService,
  ) {}

  /** patient_user_id résolu depuis le token, ou null si anonyme. */
  private patientId(req: EmbedRequest): string | null {
    const id = req.user?.id;
    return id && id !== 'embed-anonymous' ? id : null;
  }

  // ─── Patient self-service via embed-token ──────────────────────────────

  /**
   * Liste les notes partagées avec le "patient" courant.
   *
   * Si le token a un `sub` (patient_user_id résolu), retourne ses notes.
   * Sinon (mode public / patient anonymous), retourne tableau vide — le
   * widget doit afficher un état "veuillez vous identifier".
   */
  @Get('me/notes')
  @RequireEmbedScope('med:notes:read')
  async listMyNotes(@Req() req: EmbedRequest) {
    if (!req.user?.id || req.user.id === 'embed-anonymous') {
      return [];
    }
    return this.medosService.listPatientSharedNotes(req.tenant!, req.user.id);
  }

  @Post('me/notes/:id/read')
  @RequireEmbedScope('med:notes:read')
  async markRead(
    @Param('id') noteId: string,
    @Req() req: EmbedRequest,
  ) {
    if (!req.user?.id || req.user.id === 'embed-anonymous') {
      throw new BadRequestException('Patient non identifié');
    }
    return this.medosService.markSharedNoteRead(req.tenant!, req.user.id, noteId);
  }

  // ─── Formulaires patient via embed-token ──────────────────────────────

  @Get('forms')
  @RequireEmbedScope('med:forms:read')
  async listForms(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listForms(tenant);
  }

  @Get('forms/:id')
  @RequireEmbedScope('med:forms:read')
  async getForm(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.getForm(tenant, id);
  }

  // ─── Journal santé patient via embed-token ────────────────────────────

  @Post('me/health')
  @RequireEmbedScope('med:health:write')
  async createHealthEntry(
    @Body() body: Record<string, unknown>,
    @Req() req: EmbedRequest,
  ) {
    if (!req.user?.id || req.user.id === 'embed-anonymous') {
      throw new BadRequestException('Patient non identifié');
    }
    return this.medosService.createHealthEntry(req.tenant!, req.user.id, body);
  }

  // ─── Rendez-vous (RDV) via embed-token ────────────────────────────────

  @Get('me/appointments')
  @RequireEmbedScope('med:appointments:read')
  async listMyAppointments(@Req() req: EmbedRequest) {
    const pid = this.patientId(req);
    if (!pid) return [];
    return this.medosService.listMyAppointments(req.tenant!, pid);
  }

  @Post('me/appointments')
  @RequireEmbedScope('med:appointments:write')
  async bookAppointment(
    @Body() dto: Record<string, unknown>,
    @Req() req: EmbedRequest,
  ) {
    const pid = this.patientId(req);
    if (!pid) throw new BadRequestException('Patient non identifié');
    return this.appointments.create(req.tenant!, pid, 'patient', dto as never);
  }

  // ─── Ordonnances via embed-token ──────────────────────────────────────

  @Get('me/prescriptions')
  @RequireEmbedScope('med:prescriptions:read')
  async listMyPrescriptions(@Req() req: EmbedRequest) {
    const pid = this.patientId(req);
    if (!pid) return [];
    return this.prescriptions.listForCurrentPatient(req.tenant!, pid);
  }

  // ─── Messagerie via embed-token ───────────────────────────────────────

  @Get('me/threads')
  @RequireEmbedScope('med:messages:read')
  async listMyThreads(@Req() req: EmbedRequest) {
    const pid = this.patientId(req);
    if (!pid) return [];
    return this.messaging.listThreads(req.tenant!, pid, 'patient', {});
  }

  @Get('me/threads/:id/messages')
  @RequireEmbedScope('med:messages:read')
  async listThreadMessages(@Param('id') id: string, @Req() req: EmbedRequest) {
    const pid = this.patientId(req);
    if (!pid) throw new BadRequestException('Patient non identifié');
    return this.messaging.listMessages(req.tenant!, pid, 'patient', id);
  }

  @Post('me/threads/:id/messages')
  @RequireEmbedScope('med:messages:write')
  async sendThreadMessage(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @Req() req: EmbedRequest,
  ) {
    const pid = this.patientId(req);
    if (!pid) throw new BadRequestException('Patient non identifié');
    return this.messaging.send(req.tenant!, pid, 'patient', id, dto as never);
  }

  // ─── Téléconsultation via embed-token ─────────────────────────────────

  @Post('me/teleconsult/appointment/:appointmentId/join')
  @RequireEmbedScope('med:teleconsult:join')
  async joinTeleconsult(
    @Param('appointmentId') appointmentId: string,
    @Body() body: { displayName?: string },
    @Req() req: EmbedRequest,
  ) {
    const pid = this.patientId(req);
    if (!pid) throw new BadRequestException('Patient non identifié');
    return this.teleconsult.joinFromAppointment(
      req.tenant!,
      pid,
      'patient',
      appointmentId,
      body?.displayName,
    );
  }

  /**
   * Endpoint debug : retourne des infos non-sensibles sur le token courant.
   * Utile pour vérifier l'intégration côté tenant.
   */
  @Get('me/whoami')
  whoami(@Req() req: EmbedRequest) {
    return {
      tenant_slug: req.tenant?.slug,
      tenant_name: req.tenant?.name,
      authenticated: req.user?.id !== 'embed-anonymous',
    };
  }
}
