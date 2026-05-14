import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { SendNotificationDto, UpdatePreferencesDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Post('send') @UseGuards(RolesGuard) @Roles('owner','admin','teacher','secretariat')
  send(@Body() d: SendNotificationDto, @CurrentTenant() t: TenantContext) { return this.svc.send(t.id, d); }

  @Get() list(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getUserNotifications(t.id, (r as any).user.id); }

  @Patch(':id/read') markRead(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.markRead(t.id, id); }

  @Get('preferences') getPrefs(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getPreferences(t.id, (r as any).user.id); }

  @Patch('preferences') updatePrefs(@Body() d: UpdatePreferencesDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.updatePreferences(t.id, (r as any).user.id, d); }
}
