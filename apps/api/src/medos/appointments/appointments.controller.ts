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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { AuditResource } from '../decorators/audit-resource.decorator';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateAvailabilityDto,
  UpdateAppointmentDto,
  UpdateAvailabilityDto,
} from './dto/appointment.dto';
import { AppointmentsService } from './appointments.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

// ─── Availability (staff) ────────────────────────────────────────────────

@ApiTags('MedOS — Disponibilités')
@ApiBearerAuth()
@Controller('med/availability')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class AvailabilityController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  create(
    @Body() dto: CreateAvailabilityDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.createAvailability(tenant, req.user.id, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  @AuditResource({ resource: 'patient', action: 'list' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('practitioner_id') practitionerId?: string,
  ) {
    return this.service.listAvailability(tenant, practitionerId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.updateAvailability(tenant, req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.deleteAvailability(tenant, req.user.id, id);
  }
}

// ─── Appointments (staff + patient) ──────────────────────────────────────

@ApiTags('MedOS — Rendez-vous')
@ApiBearerAuth()
@Controller('med/appointments')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(tenant, req.user.id, tenant.userRole, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('patient_id') patientId?: string,
    @Query('practitioner_id') practitionerId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list(tenant, {
      patient_id: patientId,
      practitioner_id: practitionerId,
      status,
      from,
      to,
    });
  }

  @Get('slots')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  findSlots(
    @CurrentTenant() tenant: TenantContext,
    @Query('practitioner_id') practitionerId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.findSlots(tenant, practitionerId, from, to);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  @AuditResource({ resource: 'patient', action: 'read', idParam: 'id' })
  get(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.get(tenant, req.user.id, tenant.userRole, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.update(tenant, req.user.id, id, dto);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  confirm(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.confirm(tenant, req.user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.cancel(tenant, req.user.id, id, dto);
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  complete(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.complete(tenant, req.user.id, id);
  }

  @Post(':id/no-show')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  noShow(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.noShow(tenant, req.user.id, id);
  }
}
