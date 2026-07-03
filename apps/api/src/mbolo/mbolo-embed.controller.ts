import { Controller, Get, Param, Query } from '@nestjs/common';
import { MboloService } from './mbolo.service';

/**
 * EMBED PUBLIC mbolo — pour l'iframe `/embed/boutique` chargée sur N'IMPORTE QUEL site.
 *
 * Lecture SEULE du catalogue PUBLIC (produits/catégories actifs + branding), résolue
 * par slug de tenant → AUCUNE clé API exposée au navigateur. Pas de garde : un catalogue
 * est public par nature (l'acheteur le parcourt). Les écritures (panier/commande/
 * paiement) restent gardées via le storefront (clé `mbk_`) ou une session membre.
 */
@Controller('v1/mbolo/embed')
export class MboloEmbedController {
  constructor(private readonly svc: MboloService) {}

  @Get(':tenantSlug/catalog')
  catalog(
    @Param('tenantSlug') tenantSlug: string,
    @Query('category') category?: string,
  ) {
    return this.svc.getPublicCatalog(tenantSlug, category);
  }
}
