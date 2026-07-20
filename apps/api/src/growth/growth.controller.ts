import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  // Analytics + liste de leads (PII) du tenant = staff owner/admin uniquement.
  @Get('stats') @UseGuards(RolesGuard) @Roles('owner','admin') getStats(@CurrentTenant() t: TenantContext) { return this.svc.getTenantStats(t.id); }
  @Get('leads') @UseGuards(RolesGuard) @Roles('owner','admin') listLeads(@CurrentTenant() t: TenantContext) { return this.svc.listLeads(t.id); }
  @Post('leads') createLead(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createLead(t.id, d.email, d.source, d.name); }
  @Patch('leads/:id/score') @UseGuards(RolesGuard) @Roles('owner','admin')
  scoreLead(@Param('id') id: string, @Body('score') score: number, @CurrentTenant() t: TenantContext) { return this.svc.scoreLead(t.id, id, score); }

  // HUB 360° : pour un email, resout l'identite (profiles) et fan-out TOUS les moteurs
  // (mbolo/RDV/messagerie/ecole/crm) — la vue unifiee d'un contact a travers l'ecosysteme.
  @Get('contact-360') @UseGuards(RolesGuard) @Roles('owner','admin')
  contact360(@Query('email') email: string, @CurrentTenant() t: TenantContext) { return this.svc.getContact360(t.id, email); }
}
