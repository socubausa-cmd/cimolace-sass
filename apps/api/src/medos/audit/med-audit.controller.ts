import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { MedAuditService } from './med-audit.service';

@ApiTags('MedOS — Audit (admin)')
@ApiBearerAuth()
@Controller('med/admin/audit')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class MedAuditController {
  constructor(private readonly service: MedAuditService) {}

  @Get('log')
  @Roles('owner')
  listAuditLog(
    @CurrentTenant() tenant: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('actor_id') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listAuditLog(tenant, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      resource,
      action,
      actor_id: actorId,
      from,
      to,
    });
  }

  @Get('ai-runs')
  @Roles('owner')
  listAiRuns(
    @CurrentTenant() tenant: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('agent') agent?: string,
    @Query('patient_id') patientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listAiRuns(tenant, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      agent,
      patient_id: patientId,
      from,
      to,
    });
  }
}
