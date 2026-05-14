import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { NeuroRecallController } from './neuro-recall.controller';
import { NeuroRecallService } from './neuro-recall.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [NeuroRecallService], controllers: [NeuroRecallController], exports: [NeuroRecallService] })
export class NeuroRecallModule {}
