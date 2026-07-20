import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
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

  // Recherche globale (Cmd-K) : contacts + sociétés + deals.
  @Get('search')
  search(@CurrentTenant() t: TenantContext, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.svc.search(t.id, String(q || ''), Number(limit) || 8);
  }

  // Reporting sales : win-rate, forecast pondéré, conversion par étape, vélocité, leaderboard.
  @Get('analytics')
  analytics(@CurrentTenant() t: TenantContext) {
    return this.svc.analytics(t.id);
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
    @Query('owner_id') ownerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listCompanies(t.id, { search, ownerId, limit: Number(limit) || 50, offset: Number(offset) || 0 });
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

  // Reliure écosystème (société) : contacts membres + agrégats d'activité de la société.
  @Get('companies/:id/platform')
  companyPlatform(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.getCompanyPlatformLink(t.id, id);
  }

  // Fusion de sociétés (#19) : réassigne contacts/deals/historique puis supprime le perdant.
  @Post('companies/:id/merge')
  mergeCompanies(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: { into?: string }) {
    return this.svc.mergeCompanies(t.id, String(body?.into || ''), id);
  }

  // Export CSV serveur (#26) : ?entity=contacts|companies|deals.
  @Get('export')
  async exportCsv(@CurrentTenant() t: TenantContext, @Query('entity') entity: string, @Res() res: any) {
    const safe = ['contacts', 'companies', 'deals'].includes(String(entity)) ? String(entity) : 'contacts';
    const csv = await this.svc.exportCsv(t.id, safe);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="crm-${safe}.csv"`);
    res.send(csv);
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────
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
    return this.svc.listContacts(t.id, {
      search, companyId, status, ownerId, limit: Number(limit) || 50, offset: Number(offset) || 0,
    });
  }

  // Fusion (#19), RGPD anonymisation + export DSAR (#20).
  @Post('contacts/:id/merge')
  mergeContacts(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: { into?: string }) {
    return this.svc.mergeContacts(t.id, String(body?.into || ''), id);
  }

  @Post('contacts/:id/anonymize')
  anonymizeContact(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.anonymizeContact(t.id, id);
  }

  @Get('contacts/:id/export')
  exportContact(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.exportContact(t.id, id);
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

  // Envoi RÉEL d'un message (messagerie immersive) depuis la fiche, au nom de l'opérateur.
  @Post('contacts/:id/message')
  messageContact(
    @CurrentTenant() t: TenantContext,
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: { content?: string },
  ) {
    return this.svc.sendMessageToContact(t.id, u.id, id, String(body?.content || ''));
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

  @Patch('pipelines/:id')
  updatePipeline(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updatePipeline(t.id, id, body);
  }

  @Delete('pipelines/:id')
  deletePipeline(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deletePipeline(t.id, id);
  }

  @Get('pipelines/:id/stages')
  listStages(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.listStages(t.id, id);
  }

  @Post('pipelines/:id/stages/reorder')
  reorderStages(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: { stage_ids?: string[] }) {
    return this.svc.reorderStages(t.id, id, body?.stage_ids || []);
  }

  // ─── Étapes (CRUD) ───────────────────────────────────────────────────────────
  @Post('stages')
  createStage(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createStage(t.id, body);
  }

  @Patch('stages/:id')
  updateStage(@CurrentTenant() t: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateStage(t.id, id, body);
  }

  @Delete('stages/:id')
  deleteStage(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteStage(t.id, id);
  }

  // ─── Deals (kanban) ────────────────────────────────────────────────────────
  @Get('deals/board')
  dealsBoard(
    @CurrentTenant() t: TenantContext,
    @Query('pipeline_id') pipelineId?: string,
    @Query('owner_id') ownerId?: string,
  ) {
    return this.svc.dealsBoard(t.id, pipelineId, ownerId);
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
    @Query('assignee_id') assigneeId?: string,
    @Query('due') due?: string,
  ) {
    return this.svc.listTasks(t.id, { status, entityType, entityId, assigneeId, due });
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
