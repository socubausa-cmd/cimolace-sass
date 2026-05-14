import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MarketingAdvancedService } from './marketing-advanced.service';

@Controller('marketing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MarketingAdvancedController {
  constructor(private readonly svc: MarketingAdvancedService) {}

  @Get('funnels') listFunnels(@CurrentTenant() t: TenantContext) { return this.svc.listFunnels(t.id); }
  @Post('funnels') @UseGuards(RolesGuard) @Roles('owner','admin') createFunnel(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createFunnel(t.id, d.name, d.steps); }

  @Get('campaigns') listCampaigns(@CurrentTenant() t: TenantContext) { return this.svc.listCampaigns(t.id); }
  @Post('campaigns') @UseGuards(RolesGuard) @Roles('owner','admin') createCampaign(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createCampaign(t.id, d); }
  @Post('campaigns/:id/start') @UseGuards(RolesGuard) @Roles('owner','admin') startCampaign(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.startCampaign(t.id, id); }

  @Get('automations') listAutomations(@CurrentTenant() t: TenantContext) { return this.svc.listAutomations(t.id); }
  @Post('automations') @UseGuards(RolesGuard) @Roles('owner','admin') createAutomation(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createAutomation(t.id, d); }

  @Get('analytics') getAnalytics(@CurrentTenant() t: TenantContext) { return this.svc.getAnalytics(t.id); }
}
