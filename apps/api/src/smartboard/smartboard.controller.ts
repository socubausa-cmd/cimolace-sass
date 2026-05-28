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
import { SmartboardService } from './smartboard.service';

@ApiTags('Smartboard')
@ApiBearerAuth()
@Controller('smartboard')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
export class SmartboardController {
  constructor(private readonly svc: SmartboardService) {}

  @Get('decks')
  listDecks(@CurrentTenant() t: TenantContext) {
    return (this.svc as any).listDecks(t.id);
  }

  @Get('decks/:id')
  getDeck(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).getDeck(t.id, id);
  }

  @Post('decks')
  createDeck(
    @Body() d: { title: string; slides?: any[]; theme?: any },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return (this.svc as any).createDeck(d as any, t, (r as any).user?.id ?? 'system');
  }

  @Post('generate')
  generateFromText(
    @Body() d: { sourceText: string; lang?: string },
    @CurrentTenant() t: TenantContext,
  ) {
    return (this.svc as any).generateFromText(t.id, d);
  }

  @Get('themes')
  listThemes() {
    return (this.svc as any).listThemes();
  }

  @Get('templates')
  listTemplates(@CurrentTenant() t: TenantContext) {
    return (this.svc as any).listTemplates(t.id);
  }

  // ── Bloc 4 — Avancé ────────────────────────────────────────────────────

  @Get('decks/:id/quality')
  getDeckQuality(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).scoreDeckQuality(id, t.id);
  }

  @Get('slides/:id/quality')
  getSlideQuality(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).scoreSlideQuality(id, t.id);
  }

  @Get('decks/:id/versions')
  listVersions(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).listVersions(id, t.id);
  }

  @Post('decks/:id/versions')
  saveVersion(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).saveDeckVersion(id, t.id);
  }

  @Post('decks/:id/versions/:version/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('version') v: string,
    @CurrentTenant() t: TenantContext,
  ) {
    return (this.svc as any).restoreDeckVersion(id, t.id, Number(v));
  }

  @Post('decks/:id/fork')
  forkDeck(
    @Param('id') id: string,
    @Body('title') title: string,
    @CurrentTenant() t: TenantContext,
  ) {
    return (this.svc as any).forkDeck(id, t.id, title);
  }

  @Get('dashboard')
  getDashboard(@CurrentTenant() t: TenantContext) {
    return (this.svc as any).getDeckDashboard(t.id);
  }

  @Get('full-themes')
  getFullThemes() {
    return (this.svc as any).listFullThemes();
  }

  @Get('tonalites')
  getTonalites() {
    return (this.svc as any).getTonalites();
  }

  @Get('pedagogical-components')
  getPedagogicalComponents() {
    return (this.svc as any).getPedagogicalComponents();
  }

  @Get('slides/:id/overload')
  analyzeSlideOverload(
    @Param('id') id: string,
    @CurrentTenant() t: TenantContext,
  ) {
    return (this.svc as any).analyzeSlideOverload(id, t.id);
  }

  // ── Edge Functions migrees ────────────────────────────────────────────

  @Post('coach-slide')
  async coachSlide(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).coachSlide(
      t.id,
      d.slideContent || d.content,
      d.audience,
      d.style,
    );
  }

  @Post('konva-scene')
  async konvaSceneImprove(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).konvaSceneImprove(t.id, d.sceneData, d.instruction);
  }

  @Post('formation-engine')
  async formationEngine(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return (this.svc as any).formationEngine(t.id, d.topic, d.duration, d.level);
  }
}
