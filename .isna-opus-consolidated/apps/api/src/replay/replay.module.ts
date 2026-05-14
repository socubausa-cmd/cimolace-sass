import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [ReplayService], controllers: [ReplayController], exports: [ReplayService] })
export class ReplayModule {}
