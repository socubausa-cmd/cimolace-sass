import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { MasterclassFactoryController } from './masterclass-factory.controller';
import { MasterclassFactoryService } from './masterclass-factory.service';

@Module({
  imports: [SupabaseModule, TenantModule, AiBillingModule],
  providers: [MasterclassFactoryService],
  controllers: [MasterclassFactoryController],
  exports: [MasterclassFactoryService],
})
export class MasterclassFactoryModule {}
