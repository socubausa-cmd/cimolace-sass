import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({ imports: [SupabaseModule, TenantModule], providers: [MessagingService], controllers: [MessagingController], exports: [MessagingService] })
export class MessagingModule {}
