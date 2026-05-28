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
import {
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
