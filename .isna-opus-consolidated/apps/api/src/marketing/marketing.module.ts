import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MarketingAdvancedController } from './marketing-advanced.controller';
import { MarketingAdvancedService } from './marketing-advanced.service';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [MarketingService, MarketingAdvancedService],
  controllers: [MarketingController, MarketingAdvancedController],
})
export class MarketingModule {}
