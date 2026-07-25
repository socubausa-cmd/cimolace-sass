import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MasterclassFactoryService } from './masterclass-factory.service';
import { TranscriptCourseService } from './transcript-course.service';
import { CourseJobService } from './course-job.service';

// Guards au niveau CLASSE, mais @Roles au niveau MÉTHODE : l'ÉCRITURE
// (générer/sauver/analyser) reste réservée aux créateurs (owner/admin/teacher),
// tandis que la LECTURE (GET list/:id) est ouverte à TOUT membre du tenant — un
// ÉLÈVE doit pouvoir LIRE le cours Précepteur d'une masterclass pour le jouer
// (LiriPrecepteurPage → masterclassApi.get). Avant : @Roles au niveau classe →
// 403 pour les élèves sur TOUT, y compris la lecture (audit sécu 2026-07-03, P0).
@Controller('masterclass-factory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MasterclassFactoryController {
  constructor(
    private svc: MasterclassFactoryService,
    private transcriptCourse: TranscriptCourseService,
    private courseJobs: CourseJobService,
  ) {}

  /**
   * Extrait un COURS ÉCRIT depuis la transcription d'un replay (Vidéothèque).
   * Le direct est nettoyé de ses scories orales, reformulé et structuré en
   * modules/leçons (le front en fait un PDF). Réservé aux créateurs.
   */
  @Post('from-replay')
  @Roles('owner', 'admin', 'teacher')
  fromReplay(@Body() d: { videoId?: string }, @CurrentTenant() t: TenantContext) {
    return this.transcriptCourse.buildFromReplay(t.id, String(d?.videoId ?? ''));
  }
  /**
   * Demande la construction d'un COURS ENSEIGNABLE depuis un replay (Vidéothèque).
   * Traitement long → on enregistre la demande, le worker la traite et dépose le
   * cours en brouillon au poste production. Le front suit l'état via GET course-job.
   */
  @Post('course-from-replay')
  @Roles('owner', 'admin', 'teacher')
  requestCourse(@Body() d: { videoId?: string }, @CurrentTenant() t: TenantContext, @Req() r: Request) {
    return this.courseJobs.request(t.id, (r as any).user?.id, String(d?.videoId ?? ''));
  }

  @Get('course-job/:id')
  courseJob(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.courseJobs.get(t.id, id);
  }

  @Get('course-job/by-video/:videoId')
  courseJobByVideo(@Param('videoId') videoId: string, @CurrentTenant() t: TenantContext) {
    return this.courseJobs.latestForVideo(t.id, videoId);
  }

  @Post('generate') @Roles('owner','admin','teacher') generate(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.generateFromText(t.id, (r as any).user.id, d.title, d.sourceText); }
  @Post('precepteur') @Roles('owner','admin','teacher') savePrecepteur(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.savePrecepteurCourse(t.id, (r as any).user.id, d.title, d.precepteurCourse, d.sourceText, d.sourceVideoId); }
  @Get() list(@CurrentTenant() t: TenantContext) { return this.svc.listMasterclasses(t.id); }
  @Get(':id') get(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getMasterclass(t.id, id); }
  @Post('analyze') @Roles('owner','admin','teacher') analyzeDoc(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.analyzeDocument(t.id, d.url); }
}
