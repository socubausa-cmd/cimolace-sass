import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { LongiaController } from './longia.controller';
import { LongiaService } from './longia.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [LongiaService],
  controllers: [LongiaController],
  exports: [LongiaService],
})
export class LongiaModule {}
