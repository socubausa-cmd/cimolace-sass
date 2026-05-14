import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { SmsEngineService } from './sms-engine.service';

@Controller('sms-engine')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin')
export class SmsEngineController {
  constructor(private readonly svc: SmsEngineService) {}
  @Post('send') sendSms(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.sendSms(t.id, d.to, d.message); }
  @Post('whatsapp') sendWhatsApp(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.sendWhatsApp(t.id, d.to, d.template, d.params); }
  @Get('logs') getLogs(@CurrentTenant() t: TenantContext, @Query('channel') c: string) { return this.svc.getLogs(t.id, c ?? 'sms'); }
}
