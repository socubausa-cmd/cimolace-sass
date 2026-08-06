import { Module } from '@nestjs/common';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { BoutiqueController } from './boutique.controller';
import { BoutiqueService } from './boutique.service';

/**
 * Boutique numérique publique (vente de PDF + demandes d'accompagnement).
 * Aucune dépendance vers AuthModule/TenantModule : les visiteuses sont anonymes,
 * et un import de plus est un cycle potentiel dans le graphe de modules.
 * SupabaseModule est @Global → SupabaseService injectable sans import.
 */
@Module({
  imports: [PawaPayModule],
  controllers: [BoutiqueController],
  providers: [BoutiqueService],
})
export class BoutiqueModule {}
