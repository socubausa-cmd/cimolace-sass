import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { ReplayService } from './replay.service';

@Controller('replay')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReplayController {
  constructor(private readonly svc: ReplayService) {}

  @Get('recordings') listRecordings(@CurrentTenant() t: TenantContext) { return this.svc.listRecordings(t.id); }
  @Get('recordings/:id') getRecording(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getRecording(t.id, id); }
  @Get('recordings/:id/playback') getPlayback(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.generatePlaybackUrl(t.id, id); }
  @Get() listReplays(@CurrentTenant() t: TenantContext) { return this.svc.listReplays(t.id); }
}
