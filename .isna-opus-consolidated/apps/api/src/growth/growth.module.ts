import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [GrowthService], controllers: [GrowthController], exports: [GrowthService] })
export class GrowthModule {}
