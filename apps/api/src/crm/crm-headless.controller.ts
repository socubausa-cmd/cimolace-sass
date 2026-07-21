import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../liri-public/api-key.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { CrmService } from './crm.service';

/**
 * CRM HEADLESS (#12) — surface embarquable pilotable par CLÉ API tenant (X-Liri-Api-Key: lk_…),
 * comme mbolo/MEDOS/liri-public. Le CRM était le seul moteur sans surface clé-tenant → invendable
 * en « embed/headless ». Réutilise CrmService tel quel ; tenant = req.tenant (posé par ApiKeyGuard),
 * donc TOUJOURS scopé au tenant de la clé. Aucune session utilisateur requise.
 */
@Controller('v1/crm')
@UseGuards(ApiKeyGuard)
export class CrmHeadlessController {
  constructor(private readonly svc: CrmService) {}

  @Get('summary')
  summary(@CurrentTenant() t: TenantContext) { return this.svc.summary(t.id); }

  @Get('analytics')
  analytics(@CurrentTenant() t: TenantContext) { return this.svc.analytics(t.id); }

  @Get('search')
  search(@CurrentTenant() t: TenantContext, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.svc.search(t.id, String(q || ''), Number(limit) || 8);
  }

  // ─── Contacts ────────────────────────────────────────────────────────────────
  @Get('contacts')
  listContacts(
    @CurrentTenant() t: TenantContext,
    @Query('search') search?: string,
    @Query('company_id') companyId?: string,
    @Query('status') status?: string,
    @Query('owner_id') ownerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listContacts(t.id, { search, companyId, status, ownerId, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  }

  @Post('contacts')
  createContact(@CurrentTenant() t: TenantContext, @Body() body: any) { return this.svc.createContact(t.id, body); }

  @Patch('contacts/:id')
  updateContact(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) { return this.svc.updateContact(t.id, id, body); }

  @Delete('contacts/:id')
  deleteContact(@CurrentTenant() t: TenantContext, @Param('id') id: string) { return this.svc.deleteContact(t.id, id); }

  // ─── Sociétés ────────────────────────────────────────────────────────────────
  @Get('companies')
  listCompanies(@CurrentTenant() t: TenantContext, @Query('search') search?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listCompanies(t.id, { search, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  }

  @Post('companies')
  createCompany(@CurrentTenant() t: TenantContext, @Body() body: any) { return this.svc.createCompany(t.id, body); }

  @Patch('companies/:id')
  updateCompany(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) { return this.svc.updateCompany(t.id, id, body); }

  @Delete('companies/:id')
  deleteCompany(@CurrentTenant() t: TenantContext, @Param('id') id: string) { return this.svc.deleteCompany(t.id, id); }

  // ─── Pipelines & deals ───────────────────────────────────────────────────────
  @Get('pipelines')
  listPipelines(@CurrentTenant() t: TenantContext) { return this.svc.listPipelines(t.id); }

  @Get('pipelines/:id/stages')
  listStages(@CurrentTenant() t: TenantContext, @Param('id') id: string) { return this.svc.listStages(t.id, id); }

  @Get('deals/board')
  dealsBoard(@CurrentTenant() t: TenantContext, @Query('pipeline_id') pipelineId?: string, @Query('owner_id') ownerId?: string) {
    return this.svc.dealsBoard(t.id, pipelineId, ownerId);
  }

  @Post('deals')
  createDeal(@CurrentTenant() t: TenantContext, @Body() body: any) { return this.svc.createDeal(t.id, body); }

  @Patch('deals/:id')
  updateDeal(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) { return this.svc.updateDeal(t.id, id, body); }

  @Delete('deals/:id')
  deleteDeal(@CurrentTenant() t: TenantContext, @Param('id') id: string) { return this.svc.deleteDeal(t.id, id); }
}
