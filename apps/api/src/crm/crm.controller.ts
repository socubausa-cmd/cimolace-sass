import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CrmService } from './crm.service';

/**
 * CRM — cœur sales (Vague 2). Back-office : toutes les routes exigent une session
 * authentifiée + un tenant résolu + un rôle owner/admin. Le tenant vient TOUJOURS
 * du contexte (`@CurrentTenant().id`), jamais du body → 0 accès inter-tenant.
 */
@Controller('crm')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin')
export class CrmController {
  constructor(private readonly svc: CrmService) {}

  @Get('summary')
  summary(@CurrentTenant() t: TenantContext) {
    return this.svc.summary(t.id);
  }

  // Timeline d'activités : flux récent global, ou filtré par entité (entity_type + entity_id).
  @Get('activities')
  listActivities(
    @CurrentTenant() t: TenantContext,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listActivities(t.id, { entityType, entityId, limit: Number(limit) || 50 });
  }

  // ─── Companies ─────────────────────────────────────────────────────────────
  @Get('companies')
  listCompanies(
    @CurrentTenant() t: TenantContext,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listCompanies(t.id, { search, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  }

  @Post('companies')
  createCompany(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createCompany(t.id, body);
  }

  @Patch('companies/:id')
  updateCompany(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateCompany(t.id, id, body);
  }

  @Delete('companies/:id')
  deleteCompany(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteCompany(t.id, id);
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────
  @Get('contacts')
  listContacts(
    @CurrentTenant() t: TenantContext,
    @Query('search') search?: string,
    @Query('company_id') companyId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listContacts(t.id, {
      search, companyId, status, limit: Number(limit) || 50, offset: Number(offset) || 0,
    });
  }

  @Post('contacts')
  createContact(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createContact(t.id, body);
  }

  @Patch('contacts/:id')
  updateContact(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateContact(t.id, id, body);
  }

  @Delete('contacts/:id')
  deleteContact(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteContact(t.id, id);
  }

  @Post('contacts/convert-lead')
  convertLead(@CurrentTenant() t: TenantContext, @Body() body: { lead_id?: string }) {
    return this.svc.convertLead(t.id, String(body?.lead_id || ''));
  }

  // Reliure écosystème : résout l'identité plateforme du contact (email → user_id +
  // membership active) et renvoie son enrichissement 360° (commandes mbolo, RDV, services,
  // forum). Sert le bouton « Contacter » (deep-link messagerie) + la fiche 360°.
  @Get('contacts/:id/platform')
  contactPlatform(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.getContactPlatformLink(t.id, id);
  }

  // Import CSV en lot : { contacts: [{first_name,last_name,email,phone,title,company}] }.
  @Post('contacts/import')
  importContacts(@CurrentTenant() t: TenantContext, @Body() body: { contacts?: any[]; rows?: any[] }) {
    return this.svc.importContacts(t.id, body?.contacts || body?.rows || []);
  }

  // ─── Pipelines & stages ──────────────────────────────────────────────────────
  @Get('pipelines')
  listPipelines(@CurrentTenant() t: TenantContext) {
    return this.svc.listPipelines(t.id);
  }

  @Post('pipelines')
  createPipeline(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createPipeline(t.id, body);
  }

  @Get('pipelines/:id/stages')
  listStages(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.listStages(t.id, id);
  }

  // ─── Deals (kanban) ────────────────────────────────────────────────────────
  @Get('deals/board')
  dealsBoard(@CurrentTenant() t: TenantContext, @Query('pipeline_id') pipelineId?: string) {
    return this.svc.dealsBoard(t.id, pipelineId);
  }

  @Post('deals')
  createDeal(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createDeal(t.id, body);
  }

  @Patch('deals/:id')
  updateDeal(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateDeal(t.id, id, body);
  }

  @Delete('deals/:id')
  deleteDeal(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteDeal(t.id, id);
  }

  // ─── Notes ─────────────────────────────────────────────────────────────────
  @Get('notes')
  listNotes(
    @CurrentTenant() t: TenantContext,
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
  ) {
    return this.svc.listNotes(t.id, entityType, entityId);
  }

  @Post('notes')
  createNote(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createNote(t.id, body);
  }

  @Delete('notes/:id')
  deleteNote(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteNote(t.id, id);
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  @Get('tasks')
  listTasks(
    @CurrentTenant() t: TenantContext,
    @Query('status') status?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
  ) {
    return this.svc.listTasks(t.id, { status, entityType, entityId });
  }

  @Post('tasks')
  createTask(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createTask(t.id, body);
  }

  @Patch('tasks/:id')
  updateTask(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateTask(t.id, id, body);
  }

  @Delete('tasks/:id')
  deleteTask(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteTask(t.id, id);
  }

  // ─── Tags ──────────────────────────────────────────────────────────────────
  @Get('tags')
  listTags(@CurrentTenant() t: TenantContext) {
    return this.svc.listTags(t.id);
  }

  // Tags attachés à une entité (pour la fiche détail contact/société/deal).
  @Get('entity-tags')
  listEntityTags(
    @CurrentTenant() t: TenantContext,
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
  ) {
    return this.svc.listEntityTags(t.id, entityType, entityId);
  }

  @Post('tags')
  createTag(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createTag(t.id, body);
  }

  @Post('tags/attach')
  attachTag(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.attachTag(t.id, body);
  }

  @Post('tags/detach')
  detachTag(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.detachTag(t.id, body);
  }
}
