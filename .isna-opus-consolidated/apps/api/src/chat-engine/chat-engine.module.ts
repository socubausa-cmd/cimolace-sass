import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ChatEngineController } from './chat-engine.controller';
import { ChatEngineService } from './chat-engine.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [ChatEngineService], controllers: [ChatEngineController], exports: [ChatEngineService] })
export class ChatEngineModule {}
