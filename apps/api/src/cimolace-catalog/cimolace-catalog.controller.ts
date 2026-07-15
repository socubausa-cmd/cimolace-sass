import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CimolaceCatalogService } from './cimolace-catalog.service';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { UpdateTenantServiceDto } from './dto/update-tenant-service.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CimolaceCatalogController {
  constructor(private readonly catalogService: CimolaceCatalogService) {}

  /** Catalogue des moteurs Cimolace (lecture publique pour membres) */
  @Get('engines')
  getEngines() {
    return this.catalogService.getEngines();
  }

  /** Templates d'infrastructures activables */
  @Get('templates')
  getTemplates() {
    return this.catalogService.getTemplates();
  }

  /** Services actifs du tenant courant (config tenant → owner/admin) */
  @Get('tenant-services')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  getTenantServices(@CurrentTenant() tenant: TenantContext) {
    return this.catalogService.getTenantServices(tenant.id);
  }

  /** Activer / désactiver un service pour le tenant courant */
  @Post('tenant-services')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  upsertTenantService(
    @Body() dto: UpdateTenantServiceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.catalogService.upsertTenantService(tenant, dto);
  }

  /** Appliquer un template d'infrastructure au tenant courant */
  @Post('apply-template')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  applyTemplate(
    @Body() dto: ApplyTemplateDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.catalogService.applyTemplate(tenant, dto.infrastructure_type);
  }
}
