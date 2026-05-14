import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { SmsEngineController } from './sms-engine.controller';
import { SmsEngineService } from './sms-engine.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [SmsEngineService], controllers: [SmsEngineController], exports: [SmsEngineService] })
export class SmsEngineModule {}
