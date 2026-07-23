import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PromoCodesService } from './promo-codes.service';

/**
 * Codes promo — CRUD PROPRIÉTAIRE (tenant courant via X-Tenant-Slug) + validation MEMBRE
 * (lecture seule, avant paiement). L'application réelle au montant se fait côté serveur dans
 * offering-checkout.resolveAmount (jamais un prix venu du client).
 */
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly svc: PromoCodesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async list(@Req() req: any) {
    return { data: await this.svc.list(req.tenant.id) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async create(@Req() req: any, @Body() body: any) {
    return { data: await this.svc.create(req.tenant.id, body ?? {}) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return { data: await this.svc.update(req.tenant.id, id, body ?? {}) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async remove(@Req() req: any, @Param('id') id: string) {
    return { data: await this.svc.remove(req.tenant.id, id) };
  }

  /** Validation avant paiement (membre connecté) : renvoie le prix remisé pour l'UI. */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(
    @Body() body: { tenantSlug?: string; code?: string; planSlug?: string; amountCents?: number },
  ) {
    return {
      data: await this.svc.validate(
        String(body?.tenantSlug || 'isna'),
        String(body?.code || ''),
        body?.planSlug,
        body?.amountCents,
      ),
    };
  }
}
