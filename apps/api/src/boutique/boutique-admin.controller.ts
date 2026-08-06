import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { BoutiqueAdminService } from './boutique-admin.service';
import { UpdateRequestDto } from './boutique.dto';

/**
 * Suivi des ventes et des demandes — RÉSERVÉ AU STAFF DU TENANT.
 *
 * `RolesGuard` lit `req.tenant.userRole`, c'est-à-dire le rôle porté par
 * l'APPARTENANCE au tenant, pas un rôle global. Même modèle que la politique
 * d'accès des avis : un rôle global ne donne aucun droit ici.
 */
@Controller('boutique/admin')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'secretariat')
export class BoutiqueAdminController {
  constructor(private readonly svc: BoutiqueAdminService) {}

  /** Commandes du livre + chiffres de vente. */
  @Get('commandes')
  orders(
    @CurrentTenant() tenant: TenantContext,
    @Query('produit') productSlug?: string,
    @Query('statut') status?: string,
  ) {
    return this.svc.listOrders(tenant, { productSlug, status });
  }

  /** Renvoi du lien de téléchargement à une acheteuse (lien perdu ou expiré). */
  @Post('commandes/:id/renvoyer-lien')
  resend(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.svc.resendOrderLink(tenant, id);
  }

  /** Demandes d'accompagnement, de la plus récente à la plus ancienne. */
  @Get('demandes')
  requests(
    @CurrentTenant() tenant: TenantContext,
    @Query('programme') programSlug?: string,
    @Query('statut') status?: string,
  ) {
    return this.svc.listRequests(tenant, { programSlug, status });
  }

  /** Avancement d'une demande dans le pipeline (nouvelle → contactée → planifiée…). */
  @Patch('demandes/:id')
  updateRequest(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.svc.updateRequest(tenant, id, dto);
  }
}
