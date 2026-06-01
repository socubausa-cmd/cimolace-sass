import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { SmartboardController } from './smartboard.controller';
import { SmartboardService } from './smartboard.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [SmartboardService],
  controllers: [SmartboardController],
  exports: [SmartboardService],
})
export class SmartboardModule {}
