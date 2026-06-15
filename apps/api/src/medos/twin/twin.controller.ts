import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { AuditResource } from '../decorators/audit-resource.decorator';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { TwinEnabledGuard } from './twin-enabled.guard';
import {
  AddBiomarkersDto,
  CreateLabDocumentDto,
  ImportStructuredBiomarkersDto,
  OrganAssistantDto,
  ProjectionDto,
  UploadLabDocumentDto,
} from './dto/twin.dto';
import { TwinService } from './twin.service';
import { TwinGenomicsService } from './twin-genomics.service';
import { TwinMicrobiomeService } from './twin-microbiome.service';
import { TwinMetabolomicsService } from './twin-metabolomics.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

const STAFF = ['owner', 'practitioner', 'clinic_admin'] as const;

@ApiTags('MedOS — Bio Digital Twin')
@ApiBearerAuth()
@Controller('med/twin')
@UseGuards(
  JwtAuthGuard,
  TenantGuard,
  MedosEnabledGuard,
  TwinEnabledGuard,
  RolesGuard,
)
export class TwinController {
  constructor(
    private readonly service: TwinService,
    private readonly genomics: TwinGenomicsService,
    private readonly microbiome: TwinMicrobiomeService,
    private readonly metabolomics: TwinMetabolomicsService,
  ) {}

  // ── Multi-omics microbiome (P3 C1) ────────────────────────────────────
  /** Référentiel des taxons microbiome (~30 entrées, lecture seule). */
  @Get('microbiome-referential')
  @Roles(...STAFF)
  microbiomeReferential() {
    return this.microbiome.listMicrobiomeRefs();
  }

  /** Liste les mesures microbiome d'un patient (triées par date desc). */
  @Get(':patientId/microbiome')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  listPatientMicrobiome(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.microbiome.listPatientMicrobiome(tenant, patientId);
  }

  /** Saisie de mesures microbiome (manuel ou import labo). */
  @Post(':patientId/microbiome')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'create', idParam: 'patientId' })
  addPatientMicrobiome(
    @Param('patientId') patientId: string,
    @Body() body: {
      taxa: Array<{
        taxon_code: string;
        relative_abundance: number;
        sample_date?: string;
        lab_name?: string;
      }>;
    },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.microbiome.addPatientMicrobiome(
      tenant,
      req.user.id,
      patientId,
      body?.taxa ?? [],
    );
  }

  /** Évaluation déterministe de la dysbiose (score 0-100 + recommandations). */
  @Get(':patientId/microbiome/assessment')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  assessMicrobiome(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.microbiome.assessDysbiosis(tenant, patientId);
  }

  // ── Multi-omics génomique (P2 C2) ─────────────────────────────────────
  /** Référentiel des SNPs actionnables (~25 variants, lecture seule). */
  @Get('snp-referential')
  @Roles(...STAFF)
  snpReferential() {
    return this.genomics.listSnpReferential();
  }

  /** Liste les génotypes SNP d'un patient. */
  @Get(':patientId/snps')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  listPatientSnps(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.genomics.listPatientSnps(tenant, patientId);
  }

  /** Saisie de génotypes SNP (manuel ou import labo). */
  @Post(':patientId/snps')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'create', idParam: 'patientId' })
  addPatientSnps(
    @Param('patientId') patientId: string,
    @Body() body: { snps: Array<{ snp_code: string; genotype: string }> },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.genomics.addPatientSnps(tenant, req.user.id, patientId, body?.snps ?? []);
  }

  /** Interprétation déterministe : génotype → risk_level + interventions FR. */
  @Get(':patientId/snps/interpretation')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  interpretSnps(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.genomics.interpretSnps(tenant, patientId);
  }

  // ── Multi-omics métabolomique (P3 C2) ─────────────────────────────────
  /** Référentiel des métabolites (~40 marqueurs, lecture seule). */
  @Get('metabolite-referential')
  @Roles(...STAFF)
  metaboliteReferential() {
    return this.metabolomics.listMetaboliteRefs();
  }

  /** Liste les mesures métabolomiques d'un patient (triées par date desc). */
  @Get(':patientId/metabolites')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  listPatientMetabolites(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.metabolomics.listPatientMetabolites(tenant, patientId);
  }

  /** Saisie de mesures métabolomiques (manuel ou import labo). */
  @Post(':patientId/metabolites')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_biomarkers', action: 'create', idParam: 'patientId' })
  addPatientMetabolites(
    @Param('patientId') patientId: string,
    @Body()
    body: {
      items: Array<{
        metabolite_code: string;
        value: number;
        unit?: string;
        sample_date?: string;
        lab_name?: string;
      }>;
    },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.metabolomics.addPatientMetabolites(
      tenant,
      req.user.id,
      patientId,
      body?.items ?? [],
    );
  }

  /** Profil des voies biochimiques (méthylation, Krebs, mitochondrie, etc.). */
  @Get(':patientId/metabolites/profile')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  metaboliteProfile(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.metabolomics.profilePathways(tenant, patientId);
  }

  /**
   * Bibliotheque de reference : organes + biomarqueurs (Modules 18/24).
   *
   * Param optionnel `?lang=en` pour exposer name/description en anglais
   * (fondation i18n Chantier 5). Defaut : 'fr'. Toute valeur autre que
   * 'en' est normalisee a 'fr' (pas d'erreur).
   */
  @Get('referential')
  @Roles(...STAFF)
  referential(@Query('lang') lang?: string) {
    const normalized: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr';
    return this.service.getReferential(normalized);
  }

  /** Knowledge graph biologique (mindmap — Modules 8/17/22). */
  @Get('graph')
  @Roles(...STAFF)
  graph() {
    return this.service.getGraph();
  }

  /**
   * Versions du moteur deterministe + du knowledge graph (P2 C1).
   * Retourne actives + dépréciées pour permettre des comparaisons historiques.
   */
  @Get('engine-versions')
  @Roles(...STAFF)
  engineVersions() {
    return this.service.listEngineVersions();
  }

  /**
   * Timeline complète des snapshots de scores d'organes d'un patient (P2 C1).
   * Si `organ` est fourni en query, ne renvoie que cet organe.
   */
  @Get(':patientId/timeline')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_state', action: 'read', idParam: 'patientId' })
  timeline(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    const organ =
      typeof req.query?.organ === 'string' ? (req.query.organ as string) : undefined;
    return this.service.getOrganScoresTimeline(tenant, patientId, organ);
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

  /**
   * Upload + extraction d'un bilan en un seul appel (Module 3).
   *
   * Accepte PDF / JPG / PNG / WebP / GIF (max 10 Mo). Le pipeline:
   * - PDF → texte natif via pdf-parse, puis Claude texte.
   * - Image → base64 → Claude Vision.
   * Renvoie les valeurs extraites + ce qui a été inséré côté patient.
   */
  @Post(':patientId/documents/upload')
  @Roles(...STAFF)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
    }),
  )
  @AuditResource({ resource: 'twin_extraction', action: 'create', idParam: 'patientId' })
  uploadDocument(
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadLabDocumentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier reçu (champ multipart attendu : "file").',
      );
    }
    return this.service.extractFromUploadedFile(
      tenant,
      req.user.id,
      patientId,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      { source_type: body?.source_type, lab_name: body?.lab_name },
    );
  }

  /**
   * Import déterministe (CSV/JSON) — connecteur labo zéro-IA.
   *
   * Body : { items: [{ code, value, unit?, measured_at? }], lab_name? }.
   * Renvoie { imported_count, skipped, document_id, scores }.
   */
  @Post(':patientId/documents/import-csv')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_lab_document', action: 'create', idParam: 'patientId' })
  importCsv(
    @Param('patientId') patientId: string,
    @Body() dto: ImportStructuredBiomarkersDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.importStructuredBiomarkers(
      tenant,
      req.user.id,
      patientId,
      dto.items,
      { lab_name: dto.lab_name },
    );
  }

  /**
   * Liste les bilans uploadés d'un patient avec leurs métadonnées fichier
   * (audit trail GDPR : qui a uploadé, quand, taille, MIME, statut extraction).
   */
  @Get(':patientId/documents')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_lab_document', action: 'read', idParam: 'patientId' })
  listDocuments(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.listLabDocuments(tenant, patientId);
  }

  /**
   * URL signée à TTL court (5 min) pour télécharger / visualiser un bilan
   * stocké. Le service-role bypass RLS Storage, le scoping tenant/patient
   * est vérifié côté service via assertPatient.
   */
  @Get(':patientId/documents/:docId/signed-url')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_lab_document', action: 'read', idParam: 'patientId' })
  getDocSignedUrl(
    @Param('patientId') patientId: string,
    @Param('docId') docId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.getDocumentSignedUrl(tenant, patientId, docId);
  }

  /**
   * Suppression GDPR d'un bilan (retire le fichier Storage, conserve la
   * trace en DB avec status='deleted').
   */
  @Delete(':patientId/documents/:docId')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_lab_document', action: 'delete', idParam: 'patientId' })
  deleteDocument(
    @Param('patientId') patientId: string,
    @Param('docId') docId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.deleteLabDocument(tenant, patientId, docId);
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

  // ── Roue de transformation (Module 2) ─────────────────────────────────
  @Get(':patientId/wheel')
  @Roles(...STAFF)
  getWheel(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.getWheel(tenant, patientId);
  }

  @Post(':patientId/wheel')
  @Roles(...STAFF)
  saveWheel(
    @Param('patientId') patientId: string,
    @Body() body: { scores: Array<{ domain: string; score: number }> },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.saveWheel(tenant, patientId, body.scores || []);
  }

  // ── Timeline santé 360 (Module 21) ────────────────────────────────────
  @Get(':patientId/events')
  @Roles(...STAFF)
  listEvents(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.listEvents(tenant, patientId);
  }

  @Post(':patientId/events')
  @Roles(...STAFF)
  createEvent(
    @Param('patientId') patientId: string,
    @Body() body: { event_type: string; title: string; occurred_at: string; payload?: any },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.createEvent(tenant, patientId, body);
  }

  // ── Analyse longitudinale (Module 26) ─────────────────────────────────
  @Get(':patientId/history')
  @Roles(...STAFF)
  history(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.getHistory(tenant, patientId);
  }

  // ── Moteur de corrélations (Modules 9/17) ─────────────────────────────
  @Get(':patientId/correlations')
  @Roles(...STAFF)
  correlations(@Param('patientId') patientId: string, @CurrentTenant() tenant: TenantContext) {
    return this.service.getCorrelations(tenant, patientId);
  }

  // ── Simulateur d'intervention (Module 23) — déterministe ──────────────
  @Post(':patientId/simulate')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_analysis', action: 'create', idParam: 'patientId' })
  simulate(
    @Param('patientId') patientId: string,
    @Body() body: { interventions: string[] },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.simulate(tenant, patientId, body.interventions || []);
  }

  // ── Projection temporelle du jumeau (projection-v1) — déterministe ─────
  @Post(':patientId/projection')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_analysis', action: 'create', idParam: 'patientId' })
  projection(
    @Param('patientId') patientId: string,
    @Body() dto: ProjectionDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.projection(tenant, patientId, dto);
  }

  // ── Root Cause Explorer (Module 16) — IA ──────────────────────────────
  @Post(':patientId/root-cause')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_analysis', action: 'create', idParam: 'patientId' })
  rootCause(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.rootCause(tenant, req.user.id, patientId);
  }

  // ── Conseil multi-agents (Module 33) — IA ─────────────────────────────
  @Post(':patientId/council')
  @Roles(...STAFF)
  @AuditResource({ resource: 'twin_analysis', action: 'create', idParam: 'patientId' })
  council(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.council(tenant, req.user.id, patientId);
  }

  // ── Moteur scientifique (Module 15) — PubMed ──────────────────────────
  @Post('scientific')
  @Roles(...STAFF)
  scientific(@Body() body: { query: string }) {
    return this.service.scientificSearch(body.query || '');
  }
}
