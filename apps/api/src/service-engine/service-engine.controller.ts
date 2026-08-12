import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { ServiceEngineService } from './service-engine.service';
import { UpsertCategoryDto, UpsertServiceDto } from './service-engine.dto';

/**
 * Catalogue de services du tenant — RÉSERVÉ À SON STAFF.
 * `RolesGuard` lit `req.tenant.userRole`, le rôle porté par l'APPARTENANCE.
 */
@Controller('service-engine')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'secretariat')
export class ServiceEngineController {
  constructor(private readonly svc: ServiceEngineService) {}

  @Get('services')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('categorie') categoryId?: string,
    @Query('inactifs') includeInactive?: string,
  ) {
    return this.svc.list(tenant, { categoryId, includeInactive: includeInactive === '1' });
  }

  @Get('services/:id')
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.svc.get(tenant, id);
  }

  @Post('services')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertServiceDto,
  ) {
    return this.svc.create(tenant, user.id, dto);
  }

  @Patch('services/:id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertServiceDto,
  ) {
    return this.svc.update(tenant, id, dto);
  }

  /** Archive — un service référencé par des réservations passées ne se détruit pas. */
  @Delete('services/:id')
  archive(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.svc.archive(tenant, id);
  }

  // ── Catégories ────────────────────────────────────────────────────────────

  @Get('categories')
  categories(@CurrentTenant() tenant: TenantContext) {
    return this.svc.listCategories(tenant);
  }

  @Post('categories')
  createCategory(@CurrentTenant() tenant: TenantContext, @Body() dto: UpsertCategoryDto) {
    return this.svc.createCategory(tenant, dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertCategoryDto,
  ) {
    return this.svc.updateCategory(tenant, id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.svc.deleteCategory(tenant, id);
  }
}

/**
 * Vitrine publique d'un espace LIRI (§24) — AUCUN guard.
 * Ne sert que les services explicitement publiés (`is_public`).
 */
@Controller('service-engine/public')
export class ServiceEnginePublicController {
  constructor(private readonly svc: ServiceEngineService) {}

  @Get(':tenantSlug/services')
  catalog(@Param('tenantSlug') tenantSlug: string) {
    return this.svc.publicCatalog(tenantSlug);
  }
}
