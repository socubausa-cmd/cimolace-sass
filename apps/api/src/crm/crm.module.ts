import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MarketingModule } from '../marketing/marketing.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

// MarketingModule fournit MarketingAdvancedService (bus d'automations) : les événements CRM
// (deal gagné/perdu, contact créé) y sont émis pour déclencher les automations du tenant.
@Module({
  imports: [AuthModule, TenantModule, SupabaseModule, MarketingModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
