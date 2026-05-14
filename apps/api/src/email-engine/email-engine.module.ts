import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { EmailEngineController } from './email-engine.controller';
import { EmailEngineService } from './email-engine.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [EmailEngineService], controllers: [EmailEngineController], exports: [EmailEngineService] })
export class EmailEngineModule {}
