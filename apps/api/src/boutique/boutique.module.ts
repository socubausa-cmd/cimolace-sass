import { Module } from '@nestjs/common';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { BoutiqueController } from './boutique.controller';
import { BoutiqueAdminController } from './boutique-admin.controller';
import { BoutiqueService } from './boutique.service';
import { BoutiqueAdminService } from './boutique-admin.service';

/**
 * Boutique numérique : la vitrine est PUBLIQUE (acheteuses anonymes), le suivi
 * est réservé au staff du tenant.
 *
 * `TenantModule` + `AuthModule` sont nécessaires aux gardes du contrôleur admin.
 * Combinaison déjà éprouvée par PublicReviewsModule — pas de cycle dans le graphe.
 */
@Module({
  imports: [PawaPayModule, SupabaseModule, TenantModule, AuthModule],
  controllers: [BoutiqueController, BoutiqueAdminController],
  providers: [BoutiqueService, BoutiqueAdminService],
})
export class BoutiqueModule {}
