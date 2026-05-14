import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MasterclassFactoryService } from './masterclass-factory.service';

@Controller('masterclass-factory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin','teacher')
export class MasterclassFactoryController {
  constructor(private readonly svc: MasterclassFactoryService) {}
  @Post('generate') generate(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.generateFromText(t.id, (r as any).user.id, d.title, d.sourceText); }
  @Get() list(@CurrentTenant() t: TenantContext) { return this.svc.listMasterclasses(t.id); }
  @Get(':id') get(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getMasterclass(t.id, id); }
  @Post('analyze') analyzeDoc(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.analyzeDocument(t.id, d.url); }
}
