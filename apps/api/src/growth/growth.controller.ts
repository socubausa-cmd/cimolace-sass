import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { GrowthService } from './growth.service';

@Controller('growth')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GrowthController {
  constructor(private readonly svc: GrowthService) {}

  @Get('stats') getStats(@CurrentTenant() t: TenantContext) { return this.svc.getTenantStats(t.id); }
  @Get('leads') listLeads(@CurrentTenant() t: TenantContext) { return this.svc.listLeads(t.id); }
  @Post('leads') createLead(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createLead(t.id, d.email, d.source, d.name); }
  @Patch('leads/:id/score') @UseGuards(RolesGuard) @Roles('owner','admin')
  scoreLead(@Param('id') id: string, @Body('score') score: number, @CurrentTenant() t: TenantContext) { return this.svc.scoreLead(t.id, id, score); }
}
