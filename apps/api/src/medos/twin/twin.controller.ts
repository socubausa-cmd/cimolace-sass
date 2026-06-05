import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { AuditResource } from '../decorators/audit-resource.decorator';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import {
  AddBiomarkersDto,
  CreateLabDocumentDto,
  OrganAssistantDto,
} from './dto/twin.dto';
import { TwinService } from './twin.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

const STAFF = ['owner', 'practitioner', 'clinic_admin'] as const;

@ApiTags('MedOS — Bio Digital Twin')
@ApiBearerAuth()
@Controller('med/twin')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class TwinController {
  constructor(private readonly service: TwinService) {}

  /** Bibliothèque de référence : organes + biomarqueurs (Modules 18/24). */
  @Get('referential')
  @Roles(...STAFF)
  referential() {
    return this.service.getReferential();
  }

  /** Knowledge graph biologique (mindmap — Modules 8/17/22). */
  @Get('graph')
  @Roles(...STAFF)
  graph() {
    return this.service.getGraph();
  }

  /** Valider/rejeter une hypothèse (contrôle humain — le thérapeute décide). */
  @Patch('hypotheses/:id')
  @Roles(...STAFF)
  setHypothesis(
    @Param('id') id: string,
    @Body() body: { status: 'validated' | 'rejected' },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.setHypothesisStatus(tenant, id, body.status);
  }

  /** État complet du jumeau d'un patient (centre de commande — Module 35). */
  @Get(':patientId/state')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  state(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.getState(tenant, patientId);
  }

  /** Dernières valeurs de biomarqueurs (laboratoire virtuel — Module 15). */
  @Get(':patientId/biomarkers')
  @Roles(...STAFF)
  biomarkers(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.listLatestBiomarkers(tenant, patientId);
  }

  /** Saisie de biomarqueurs (manuelle) → recalcul automatique des scores. */
  @Post(':patientId/biomarkers')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_biomarkers', action: 'create', idParam: 'patientId' })
  addBiomarkers(
    @Param('patientId') patientId: string,
    @Body() dto: AddBiomarkersDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.addBiomarkers(tenant, req.user.id, patientId, dto);
  }

  /** Recalcul des scores d'organes + alertes (moteur déterministe). */
  @Post(':patientId/compute')
  @Roles(...STAFF)
  compute(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.computeScores(tenant, patientId);
  }

  /** Créer un document labo (Module 3). */
  @Post(':patientId/documents')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_lab_document', action: 'create', idParam: 'patientId' })
  createDocument(
    @Param('patientId') patientId: string,
    @Body() dto: CreateLabDocumentDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.createLabDocument(tenant, patientId, dto);
  }

  /** Extraction IA d'un document labo → biomarqueurs (Module 3). */
  @Post(':patientId/documents/:docId/extract')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_extraction', action: 'create', idParam: 'patientId' })
  extract(
    @Param('patientId') patientId: string,
    @Param('docId') docId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.extractDocument(tenant, req.user.id, patientId, docId);
  }

  /** Assistant Organe — IA explicable (Modules 11/19). */
  @Post(':patientId/organ-assistant')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_organ_assistant', action: 'create', idParam: 'patientId' })
  organAssistant(
    @Param('patientId') patientId: string,
    @Body() dto: OrganAssistantDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.organAssistant(tenant, req.user.id, patientId, dto);
  }

  /** Analyse multi-agents : hypothèses différentielles (Modules 16/18). */
  @Post(':patientId/analyze')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_analysis', action: 'create', idParam: 'patientId' })
  analyze(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.analyze(tenant, req.user.id, patientId);
  }
}
