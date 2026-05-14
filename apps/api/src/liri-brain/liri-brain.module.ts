import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { LiriBrainController } from './liri-brain.controller';
import { LiriBrainService } from './liri-brain.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [LiriBrainService],
  controllers: [LiriBrainController],
  exports: [LiriBrainService],
})
export class LiriBrainModule {}
