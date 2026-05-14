import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { SmartboardService } from './smartboard.service';

@Controller('smartboard')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
export class SmartboardController {
  constructor(private readonly svc: SmartboardService) {}

  @Get('decks')
  listDecks(@CurrentTenant() t: TenantContext) {
    return this.svc.listDecks(t.id);
  }

  @Get('decks/:id')
  getDeck(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getDeck(t.id, id);
  }

  @Post('decks')
  createDeck(
    @Body() d: { title: string; slides?: any[]; theme?: any },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.createDeck(d as any, t, (r as any).user?.id ?? 'system');
  }

  @Post('generate')
  generateFromText(
    @Body() d: { sourceText: string; lang?: string },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.svc.generateFromText(t.id, d);
  }

  @Get('themes')
  listThemes() {
    return this.svc.listThemes();
  }

  @Get('templates')
  listTemplates(@CurrentTenant() t: TenantContext) {
    return this.svc.listTemplates(t.id);
  }

  // ── Bloc 4 — Avancé ────────────────────────────────────────────────────

  @Get('decks/:id/quality')
  getDeckQuality(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.scoreDeckQuality(id, t.id);
  }

  @Get('slides/:id/quality')
  getSlideQuality(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.scoreSlideQuality(id, t.id);
  }

  @Get('decks/:id/versions')
  listVersions(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.listVersions(id, t.id);
  }

  @Post('decks/:id/versions')
  saveVersion(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.saveDeckVersion(id, t.id);
  }

  @Post('decks/:id/versions/:version/restore')
  restoreVersion(@Param('id') id: string, @Param('version') v: string, @CurrentTenant() t: TenantContext) {
    return this.svc.restoreDeckVersion(id, t.id, Number(v));
  }

  @Post('decks/:id/fork')
  forkDeck(@Param('id') id: string, @Body('title') title: string, @CurrentTenant() t: TenantContext) {
    return this.svc.forkDeck(id, t.id, title);
  }

  @Get('dashboard')
  getDashboard(@CurrentTenant() t: TenantContext) {
    return this.svc.getDeckDashboard(t.id);
  }

  @Get('full-themes')
  getFullThemes() {
    return this.svc.listFullThemes();
  }

  @Get('tonalites')
  getTonalites() {
    return this.svc.getTonalites();
  }

  @Get('pedagogical-components')
  getPedagogicalComponents() {
    return this.svc.getPedagogicalComponents();
  }

  @Get('slides/:id/overload')
  analyzeSlideOverload(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.analyzeSlideOverload(id, t.id);
  }
}
