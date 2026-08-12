import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { ServiceEngineController, ServiceEnginePublicController } from './service-engine.controller';
import { ServiceEngineService } from './service-engine.service';

/**
 * LIRI Service Engine — phase 1 : catalogue et catégories par tenant.
 *
 * Le moteur est volontairement INDÉPENDANT de la visioconférence (§3) : un
 * service peut être livré sur place ou à domicile sans qu'aucune salle LIRI
 * n'existe. Le branchement vers le Live se fera en phase 4, en réutilisant
 * `POST booking/appointments/:id/start-live` qui existe déjà.
 */
@Module({
  imports: [SupabaseModule, TenantModule, AuthModule],
  controllers: [ServiceEngineController, ServiceEnginePublicController],
  providers: [ServiceEngineService],
  exports: [ServiceEngineService],
})
export class ServiceEngineModule {}
