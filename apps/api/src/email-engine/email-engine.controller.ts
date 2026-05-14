import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateTemplateDto, SendCampaignDto, SendEmailDto } from './dto/email.dto';
import { EmailEngineService } from './email-engine.service';

@Controller('email-engine')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner','admin')
export class EmailEngineController {
  constructor(private readonly svc: EmailEngineService) {}

  @Get('templates') listTemplates(@CurrentTenant() t: TenantContext) { return this.svc.listTemplates(t.id); }
  @Post('templates') createTemplate(@Body() d: CreateTemplateDto, @CurrentTenant() t: TenantContext) { return this.svc.createTemplate(t.id, d); }
  @Post('send') sendEmail(@Body() d: SendEmailDto, @CurrentTenant() t: TenantContext) { return this.svc.sendEmail(t.id, d); }
  @Post('campaigns') sendCampaign(@Body() d: SendCampaignDto, @CurrentTenant() t: TenantContext) { return this.svc.sendCampaign(t.id, d); }
  @Get('campaigns') listCampaigns(@CurrentTenant() t: TenantContext) { return this.svc.listCampaigns(t.id); }
}
