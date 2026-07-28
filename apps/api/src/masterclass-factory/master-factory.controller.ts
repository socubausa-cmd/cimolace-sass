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
 *   /master-factory/render/pdf
 *
 * Les futurs rendus `master-script`, `smartboard-timeline`, `live-scenario`
 * seront ajoutés ici, sans multiplier les moteurs.
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
