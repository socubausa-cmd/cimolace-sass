import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [MarketingService],
  controllers: [MarketingController],
})
export class MarketingModule {}
