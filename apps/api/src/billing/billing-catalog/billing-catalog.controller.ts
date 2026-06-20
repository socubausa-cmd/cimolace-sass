import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantGuard } from '../../tenant/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import type { TenantContext } from '../../tenant/tenant.types';
import { BillingCatalogService } from './billing-catalog.service';
import {
  CreateCatalogServiceDto,
  UpdateCatalogServiceDto,
} from './billing-catalog.dto';

/**
 * Catalogue des SERVICES vendus par un tenant (back-office → Offres / Catalogue).
 *
 * Auth : JWT + tenant résolu via header X-Tenant-Slug (TenantGuard) + rôle
 * owner|admin du tenant (RolesGuard). Le tenant courant est injecté par
 * @CurrentTenant (jamais pris du body → pas d'usurpation cross-tenant).
 *
 * Toutes les opérations sont SCOPÉES par tenant_id côté service : un owner ne
 * peut jamais lire/éditer/supprimer le plan d'un autre tenant.
 */
@Controller('billing/catalog')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin')
export class BillingCatalogController {
  constructor(private readonly svc: BillingCatalogService) {}

  /** Liste tous les services du tenant (toutes catégories, actifs + inactifs). */
  @Get()
  async list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t);
  }

  /** Crée un service (clé dérivée du label si non fournie). */
  @Post()
  async create(
    @CurrentTenant() t: TenantContext,
    @Body() body: CreateCatalogServiceDto,
  ) {
    return this.svc.create(t, body);
  }

  /** Met à jour un service du tenant (PATCH partiel). */
  @Patch(':key')
  async update(
    @CurrentTenant() t: TenantContext,
    @Param('key') key: string,
    @Body() body: UpdateCatalogServiceDto,
  ) {
    return this.svc.update(t, key, body);
  }

  /**
   * Désactive un service (is_active=false). `?hard=true` → suppression définitive.
   */
  @Delete(':key')
  async remove(
    @CurrentTenant() t: TenantContext,
    @Param('key') key: string,
    @Query('hard') hard?: string,
  ) {
    return this.svc.remove(t, key, hard === 'true');
  }
}
