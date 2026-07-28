import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MasterFactoryService } from './master-factory.service';
import type { SourceType } from './pivot.types';

/**
 * MASTER FACTORY — routes officielles.
 *
 * Les anciennes routes `masterclass-factory/atelier/*` restent compatibles.
 * Cette surface devient le vocabulaire stable pour Liri Portail :
 *
 *   /master-factory/sources
 *   /master-factory/understand
 *   /master-factory/produce/course
 *   /master-factory/produce/master-script
 *   /master-factory/produce/smartboard
 *   /master-factory/produce/live-scenario
 *   /master-factory/produce/live-stack
 *   /master-factory/render/pdf
 *
 * Ces routes partent toutes du même pivot `comprehension`.
 */
@Controller('master-factory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MasterFactoryController {
  constructor(private readonly factory: MasterFactoryService) {}

  /** Sources disponibles pour le tenant, par type. */
  @Get('sources/:type')
  @Roles('owner', 'admin', 'teacher')
  listSources(@Param('type') type: SourceType, @CurrentTenant() tenant: TenantContext) {
    return this.factory.listSources(tenant.id, type);
  }

  /** Comprendre une source : produit/récupère le pivot `comprehension`. */
  @Post('understand')
  @Roles('owner', 'admin', 'teacher')
  understand(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.understandSource(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /** État des pivots et rendus disponibles pour une source. */
  @Get('status/:type/:id')
  @Roles('owner', 'admin', 'teacher')
  status(
    @Param('type') type: SourceType,
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.status(tenant.id, type, id);
  }

  /**
   * Produire un cours écrit/parcours depuis une source.
   * Traitement long : l'appel crée/réutilise un job traité par le worker.
   */
  @Post('produce/course')
  @Roles('owner', 'admin', 'teacher')
  produceCourse(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.factory.requestWrittenCourse(
      tenant.id,
      (req as any).user?.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /** Produire le conducteur oral officiel depuis le pivot compréhension. */
  @Post('produce/master-script')
  @Roles('owner', 'admin', 'teacher')
  produceMasterScript(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.buildMasterScript(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /** Produire la timeline SmartBoard vivant depuis le Master Script. */
  @Post('produce/smartboard')
  @Roles('owner', 'admin', 'teacher')
  produceSmartboard(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.buildSmartboardTimeline(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /** Produire le scénario Liri Live depuis Master Script + SmartBoard. */
  @Post('produce/live-scenario')
  @Roles('owner', 'admin', 'teacher')
  produceLiveScenario(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.buildLiveScenario(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /**
   * Produire toute la chaîne vivante :
   * comprehension existante → Master Script → SmartBoard Timeline → Live Scenario.
   */
  @Post('produce/live-stack')
  @Roles('owner', 'admin', 'teacher')
  produceLiveStack(
    @Body() body: { sourceType?: SourceType; sourceId?: string; force?: boolean },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.buildLiveStack(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
      { force: body?.force === true },
    );
  }

  /** Rendu PDF depuis le pivot écrit : zéro nouvel appel IA. */
  @Post('render/pdf')
  @Roles('owner', 'admin', 'teacher')
  renderPdf(
    @Body() body: { sourceType?: SourceType; sourceId?: string },
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.factory.renderPdf(
      tenant.id,
      body?.sourceType ?? 'replay',
      String(body?.sourceId ?? ''),
    );
  }
}
