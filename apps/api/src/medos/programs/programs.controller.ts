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
import { MedosEnabledGuard } from '../medos-enabled.guard';
import {
  CreateProgramDto,
  CreateStepDto,
  EnrollPatientDto,
  UpdateEnrollmentDto,
  UpdateProgramDto,
} from './dto/programs.dto';
import { ProgramsService } from './programs.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

@ApiTags('MedOS — Programmes de soins')
@ApiBearerAuth()
@Controller('med/programs')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class ProgramsController {
  constructor(private readonly service: ProgramsService) {}

  @Post()
  @Roles('owner', 'practitioner', 'clinic_admin')
  create(
    @Body() dto: CreateProgramDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(tenant, req.user.id, dto);
  }

  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('category') category?: string,
  ) {
    return this.service.list(tenant, category);
  }

  @Get(':id')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  get(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.get(tenant, id);
  }

  @Patch(':id')
  @Roles('owner', 'practitioner', 'clinic_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.update(tenant, id, dto);
  }

  // ── Steps ──────────────────────────────────────────────────────────────

  @Post(':id/steps')
  @Roles('owner', 'practitioner', 'clinic_admin')
  addStep(
    @Param('id') programId: string,
    @Body() dto: CreateStepDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.addStep(tenant, programId, dto);
  }

  @Get(':id/steps')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  listSteps(
    @Param('id') programId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.listSteps(tenant, programId);
  }

  @Delete(':id/steps/:stepId')
  @Roles('owner', 'practitioner', 'clinic_admin')
  removeStep(
    @Param('id') programId: string,
    @Param('stepId') stepId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.removeStep(tenant, programId, stepId);
  }

  // ── Enrollments ────────────────────────────────────────────────────────

  @Post(':id/enroll')
  @Roles('owner', 'practitioner', 'clinic_admin')
  enroll(
    @Param('id') programId: string,
    @Body() dto: EnrollPatientDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.enroll(tenant, req.user.id, programId, dto);
  }
}

// ─── Enrollments (cross-program endpoints) ─────────────────────────────

@ApiTags('MedOS — Inscriptions programmes')
@ApiBearerAuth()
@Controller('med/enrollments')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly service: ProgramsService) {}

  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('patient_id') patientId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listEnrollments(
      tenant,
      req.user.id,
      tenant.userRole,
      {
        patient_id: patientId,
        status,
      },
    );
  }

  @Patch(':id')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.updateEnrollment(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
      dto,
    );
  }
}
