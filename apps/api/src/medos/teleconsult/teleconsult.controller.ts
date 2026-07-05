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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { TeleconsultRegisterRateLimitGuard } from './register-rate-limit.guard';
import {
  ConsentInviteDto,
  CreateInviteDto,
  CreateTeleconsultDto,
  EndTeleconsultDto,
} from './dto/teleconsult.dto';
import { TeleconsultService } from './teleconsult.service';

type AuthRequest = Request & {
  user: { id: string; email?: string; name?: string };
};

@ApiTags('MedOS — Téléconsultation')
@ApiBearerAuth()
@Controller('med/teleconsult')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class TeleconsultController {
  constructor(private readonly service: TeleconsultService) {}

  @Post()
  @Roles('owner', 'practitioner', 'clinic_admin')
  create(
    @Body() dto: CreateTeleconsultDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(tenant, req.user.id, dto);
  }

  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('patient_id') patientId?: string,
  ) {
    return this.service.list(tenant, { patient_id: patientId });
  }

  /** Délivre un token LiveKit pour rejoindre la room (host ou participant) */
  @Post(':id/token')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  issueToken(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.issueToken(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
      req.user.email,
    );
  }

  /**
   * Contexte clinique de la session, pour le COCKPIT partagé (jumeau 3D /
   * SOAP / graphiques). Renvoie { patient_id, patient_name, role } — le
   * cockpit charge ensuite le dossier via les endpoints jumeau/charting.
   * Accessible au staff soignant ET au patient (chacun borné à ses droits
   * dans le service : le patient ne voit QUE sa propre session).
   */
  @Get(':id/clinical-context')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  clinicalContext(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.getClinicalContext(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
    );
  }

  // ── Inviter un proche (+ consentement RGPD) ───────────────────────────────

  /** Host : crée une invitation pour un proche → renvoie le token (= id). */
  @Post(':id/invites')
  @Roles('owner', 'practitioner', 'clinic_admin')
  createInvite(
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.createInvite(tenant, req.user.id, id, dto);
  }

  /** Host OU patient-propriétaire : liste les invitations actives de la session. */
  @Get(':id/invites')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  listInvites(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.listInvites(tenant, req.user.id, tenant.userRole, id);
  }

  /** PATIENT uniquement : autorise/refuse la participation du proche (RGPD). */
  @Post(':id/invites/:inviteId/consent')
  @Roles('patient')
  consentInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @Body() dto: ConsentInviteDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.consentInvite(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
      inviteId,
      dto.granted,
    );
  }

  /** HOST : admet un proche même sans le patient (maître de séance). */
  @Post(':id/invites/:inviteId/admit')
  @Roles('owner', 'practitioner', 'clinic_admin')
  admitInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.admitInvite(tenant, req.user.id, id, inviteId);
  }

  /** Host OU patient-propriétaire : révoque une invitation. */
  @Post(':id/invites/:inviteId/revoke')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  revokeInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.revokeInvite(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
      inviteId,
    );
  }

  /** MODÉRATION HÔTE : coupe le micro (sourdine) d'un participant à distance. */
  @Post(':id/participants/mute')
  @Roles('owner', 'practitioner', 'clinic_admin')
  muteParticipant(
    @Param('id') id: string,
    @Body() body: { identity: string },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.muteParticipant(tenant, tenant.userRole, id, body?.identity);
  }

  /** MODÉRATION HÔTE : expulse un participant du live. */
  @Post(':id/participants/remove')
  @Roles('owner', 'practitioner', 'clinic_admin')
  removeParticipant(
    @Param('id') id: string,
    @Body() body: { identity: string },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.removeParticipant(tenant, tenant.userRole, id, body?.identity);
  }

  /** Marque le participant comme entré (appelé par le frontend après rejoindre) */
  @Post(':id/join')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  join(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.markJoined(tenant, tenant.userRole, id);
  }

  @Post(':id/end')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  end(
    @Param('id') id: string,
    @Body() dto: EndTeleconsultDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.end(tenant, tenant.userRole, id, dto);
  }

  /**
   * Balaye les téléconsults ABANDONNÉES du tenant (hôte absent de la room
   * depuis > 5 min → fin d'office + room fermée). Le même balayage tourne
   * en cron interne toutes les 2 min ; cet endpoint permet un déclenchement
   * manuel (test / rattrapage).
   */
  @Post('sweep')
  @Roles('owner', 'practitioner', 'clinic_admin')
  sweep(@CurrentTenant() tenant: TenantContext) {
    return this.service.sweepAbandoned(tenant.id);
  }

  /**
   * One-shot helper for the UI: takes an appointment_id, gets-or-creates
   * the underlying teleconsult session (depending on role), then issues a
   * LiveKit token. The "Démarrer la téléconsult" / "Rejoindre" buttons
   * call this from a single click.
   */
  @Post('appointment/:appointmentId/join')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  joinFromAppointment(
    @Param('appointmentId') appointmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.joinFromAppointment(
      tenant,
      req.user.id,
      tenant.userRole,
      appointmentId,
      req.user.email,
    );
  }
}

/**
 * Endpoints PUBLICS pour le PROCHE invité (pas de compte tenant). Gardés par le
 * seul token d'invitation (= l'id, non devinable). Fail-closed : le token vidéo
 * n'est délivré que si le patient a consenti (vérifié dans le service).
 */
@ApiTags('MedOS — Téléconsultation (proche)')
@Controller('med/teleconsult-invite-public')
export class TeleconsultInvitePublicController {
  constructor(private readonly service: TeleconsultService) {}

  /** Statut de l'invitation (consentement en attente / accordé / refusé). */
  @Get(':inviteId/status')
  status(@Param('inviteId') inviteId: string) {
    return this.service.getInvitePublicStatus(inviteId);
  }

  /** Délivre le token vidéo invité — uniquement si le patient a consenti. */
  @Post(':inviteId/token')
  token(@Param('inviteId') inviteId: string) {
    return this.service.issueInviteToken(inviteId);
  }

  /**
   * PUBLIC : auto-inscription au « lien de groupe » d'une séance. La personne
   * saisit son nom + email → on crée SA propre invitation (siège unique, zéro
   * kick) → elle est renvoyée vers la salle d'attente /proche/<invite_id>.
   */
  @Post('register')
  @UseGuards(TeleconsultRegisterRateLimitGuard)
  register(
    @Body()
    body: {
      session_id: string;
      name: string;
      email?: string;
      relationship?: string;
    },
  ) {
    return this.service.selfRegisterInvite(body?.session_id, body);
  }
}
