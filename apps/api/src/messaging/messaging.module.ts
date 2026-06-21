import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [MessagingService, TopicsService],
  controllers: [MessagingController, TopicsController],
  exports: [MessagingService, TopicsService],
})
export class MessagingModule {}
