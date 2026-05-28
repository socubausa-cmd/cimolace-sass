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
  CreateConsentDto,
  RequestAnonymizationDto,
  RequestExportDto,
} from './dto/gdpr.dto';
import { GdprService } from './gdpr.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

@ApiTags('MedOS — RGPD')
@ApiBearerAuth()
@Controller('med/gdpr')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class GdprController {
  constructor(private readonly service: GdprService) {}

  // ── Consents ───────────────────────────────────────────────────────────

  @Post('consents')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  recordConsent(
    @Body() dto: CreateConsentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.recordConsent(
      tenant,
      req.user.id,
      tenant.userRole,
      dto,
      req,
    );
  }

  @Get('consents/patient/:patientId')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  listConsents(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.listConsents(
      tenant,
      req.user.id,
      tenant.userRole,
      patientId,
    );
  }

  @Post('consents/:id/revoke')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  revokeConsent(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.revokeConsent(tenant, req.user.id, tenant.userRole, id);
  }

  // ── Exports ────────────────────────────────────────────────────────────

  @Post('exports')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  requestExport(
    @Body() dto: RequestExportDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.requestExport(
      tenant,
      req.user.id,
      tenant.userRole,
      dto,
    );
  }

  @Get('exports')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  listExports(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('patient_id') patientId?: string,
  ) {
    return this.service.listExports(
      tenant,
      req.user.id,
      tenant.userRole,
      patientId,
    );
  }

  // ── Anonymizations ─────────────────────────────────────────────────────

  @Post('anonymizations')
  @Roles('owner', 'clinic_admin', 'patient')
  requestAnonymization(
    @Body() dto: RequestAnonymizationDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.requestAnonymization(
      tenant,
      req.user.id,
      tenant.userRole,
      dto,
    );
  }

  @Get('anonymizations')
  @Roles('owner', 'clinic_admin')
  listAnonymizations(@CurrentTenant() tenant: TenantContext) {
    return this.service.listAnonymizations(tenant);
  }
}
