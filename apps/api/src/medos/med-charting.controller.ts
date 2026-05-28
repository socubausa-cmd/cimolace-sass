import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { StartChartingDto } from './dto/start-charting.dto';
import { AuditResource } from './decorators/audit-resource.decorator';
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedChartingService } from './med-charting.service';

interface AuthRequest extends Request {
  user: { id: string; email?: string };
}

/**
 * MedOS AI Charting — pipeline audio → transcription → note SOAP
 *
 * Routes :
 *   POST /med/charting/start          — démarrer un job (async)
 *   GET  /med/charting/jobs/:jobId    — consulter le statut d'un job
 *   GET  /med/charting/patient/:id    — lister les jobs d'un patient
 */
@ApiTags('MedOS — Charting IA')
@ApiBearerAuth()
@Controller('med/charting')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
@Roles('owner', 'practitioner', 'clinic_admin')
export class MedChartingController {
  constructor(private readonly chartingService: MedChartingService) {}

  /**
   * POST /med/charting/start
   *
   * Démarre le pipeline de charting IA pour une consultation.
   * Retourne immédiatement le job créé (statut "pending").
   * Le client doit ensuite poller GET /med/charting/jobs/:jobId
   * jusqu'à statut "completed" ou "failed".
   *
   * Corps :
   *   - patient_id   : UUID du dossier patient
   *   - audio_url    : URL publique ou signée du fichier audio
   *   - note_id?     : UUID d'une note existante à enrichir (optionnel)
   *   - context_hint?: contexte libre pour affiner Claude (ex : "diabétique type 2")
   *   - language?    : langue de l'audio (défaut : fr)
   */
  @Post('start')
  @AuditResource({ resource: 'charting_job', action: 'create' })
  startCharting(
    @Body() dto: StartChartingDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.chartingService.startChartingJob(tenant, req.user.id, dto);
  }

  /**
   * GET /med/charting/jobs/:jobId
   *
   * Retourne le statut complet du job :
   *   pending → transcribing → generating → completed | failed
   *
   * Quand le statut est "completed", le champ note_id contient
   * l'UUID de la note draft générée, prête à être éditée et signée.
   */
  @Get('jobs/:jobId')
  @AuditResource({ resource: 'charting_job', action: 'read', idParam: 'jobId' })
  getJobStatus(
    @Param('jobId') jobId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.chartingService.getJobStatus(tenant, jobId);
  }

  /**
   * GET /med/charting/patient/:patientId
   *
   * Liste l'historique des jobs de charting pour un patient donné,
   * du plus récent au plus ancien.
   */
  @Get('patient/:patientId')
  @AuditResource({ resource: 'charting_job', action: 'list', idParam: 'patientId' })
  listPatientJobs(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.chartingService.listJobsForPatient(tenant, patientId);
  }
}
