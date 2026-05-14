import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { PayEngineController } from './pay-engine.controller';
import { PayEngineService } from './pay-engine.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [PayEngineService], controllers: [PayEngineController], exports: [PayEngineService] })
export class PayEngineModule {}
