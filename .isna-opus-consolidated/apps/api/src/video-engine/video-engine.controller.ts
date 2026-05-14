import {
  Controller, Get, Post, Delete,
  Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { VideoEngineService } from './video-engine.service';
import { CreateVideoAssetDto } from './dto/create-video-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import type { Request } from 'express';

@Controller('video-engine')
@UseGuards(JwtAuthGuard)
export class VideoEngineController {
  constructor(private readonly svc: VideoEngineService) {}

  @Get('assets')
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.listAssets(t.id);
  }

  @Get('assets/:id')
  get(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getAsset(t.id, id);
  }

  @Post('assets')
  create(
    @Body() dto: CreateVideoAssetDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.createAsset(t.id, (req as any).user.id, dto);
  }

  @Delete('assets/:id')
  remove(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteAsset(t.id, id);
  }

  // Webhook Mux (public — Mux signe le payload)
  @Post('webhook/mux')
  webhookMux(@Body() body: Record<string, unknown>) {
    return this.svc.handleProviderWebhook('mux', body);
  }

  // Webhook Cloudflare Stream
  @Post('webhook/cloudflare')
  webhookCloudflare(@Body() body: Record<string, unknown>) {
    return this.svc.handleProviderWebhook('cloudflare', body);
  }
}
