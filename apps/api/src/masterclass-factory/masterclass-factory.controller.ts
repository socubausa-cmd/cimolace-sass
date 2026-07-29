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
import { ReplayChaptersService } from './replay-chapters.service';
import { ComprehensionService } from './comprehension.service';
import { SourceAdaptersService } from './source-adapters.service';
import { RenderPivotService } from './render-pivot.service';

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
    private replayChapters: ReplayChaptersService,
    private comprehension: ComprehensionService,
    private sourceAdapters: SourceAdaptersService,
    private renderPivot: RenderPivotService,
  ) {}

  // ═══ ATELIER DE COURS UNIFIÉ (lot 2) — le NOYAU ═══
  //
  // Une seule extraction pour TOUTES les sources (replay, TikTok, document,
  // texte). Produit le pivot « comprehension » : le FOND, extrait UNE fois.
  // Les formes et les rendus en découleront sans rappeler le modèle.

  /** Sources disponibles et état de leur transcription (écran Atelier). */
  @Get('atelier/sources/:type')
  @Roles('owner', 'admin', 'teacher')
  listSources(@Param('type') type: string, @CurrentTenant() t: TenantContext) {
    return this.sourceAdapters.listSources(t.id, type as any);
  }

  /**
   * Extrait (ou récupère) le FOND d'une source. Idempotent : si le pivot
   * existe déjà, il est rendu tel quel — on ne repaye jamais l'IA deux fois
   * pour la même source, sauf `force: true`.
   */
  /** Ce qui existe déjà pour une source — donc rendable SANS nouveau coût IA. */
  @Get('atelier/etat/:type/:id')
  @Roles('owner', 'admin', 'teacher')
  atelierEtat(@Param('type') type: string, @Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.renderPivot.status(t.id, type as any, id);
  }

  /**
   * PDF depuis le pivot — ZÉRO appel IA. Si le cours écrit n'existe pas encore,
   * on refuse franchement plutôt que de relancer une génération facturée.
   */
  @Post('atelier/rendre/pdf')
  @Roles('owner', 'admin', 'teacher')
  rendrePdf(
    @Body() d: { sourceType?: string; sourceId?: string },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.renderPivot.renderPdf(t.id, (d?.sourceType ?? 'replay') as any, String(d?.sourceId ?? ''));
  }

  /**
   * Met une source QUELCONQUE en file de construction (replay ou TikTok).
   * Idempotent : source déjà en cours ou déjà transformée → on renvoie le job
   * existant au lieu de repayer.
   */
  @Post('atelier/construire')
  @Roles('owner', 'admin', 'teacher')
  atelierConstruire(
    @Body() d: { sourceType?: string; sourceId?: string; force?: boolean },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.courseJobs.requestAny(
      t.id,
      (r as any).user?.id,
      d?.sourceType ?? 'replay',
      String(d?.sourceId ?? ''),
      { force: !!d?.force },
    );
  }

  @Post('atelier/comprendre')
  @Roles('owner', 'admin', 'teacher')
  comprendre(
    @Body() d: { sourceType?: string; sourceId?: string; force?: boolean },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.comprehension.build(
      t.id,
      (d?.sourceType ?? 'replay') as any,
      String(d?.sourceId ?? ''),
      { force: !!d?.force },
    );
  }

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
   * CHAPITRAGE SÉMANTIQUE d'un replay : repère les vraies ruptures de sujet dans
   * la transcription horodatée et les persiste dans published_videos.chapters.
   * Réservé aux créateurs, comme from-replay : l'opération consomme des jetons IA.
   * Les ÉLÈVES se contentent de LIRE les chapitres déjà générés (published_videos
   * remonte au front via zoom-engine) — ils n'en déclenchent jamais.
   * Idempotent : renvoie l'existant sans rappeler le modèle, sauf `force: true`.
   */
  @Post('chapters-from-replay')
  @Roles('owner', 'admin', 'teacher')
  chaptersFromReplay(
    @Body() d: { videoId?: string; force?: boolean },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.replayChapters.generate(t.id, String(d?.videoId ?? ''), { force: d?.force === true });
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

  /**
   * PONT « Importer une vidéo » du Studio → pipeline post-production.
   * Le fichier a déjà été téléversé dans le bucket public `videos` ; on le recopie
   * sur R2 et on crée un VRAI `published_videos` (transcript vide → le worker
   * Deepgram transcrit). Renvoie l'id réel à utiliser comme contentId côté Studio,
   * à la place de l'UUID aléatoire qui ne référençait aucune ligne.
   */
  @Post('studio-import')
  @Roles('owner', 'admin', 'teacher')
  studioImport(
    @Body() d: { storagePath?: string; title?: string; description?: string; durationSeconds?: number },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.courseJobs.importStudioFile(t.id, d ?? {});
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
