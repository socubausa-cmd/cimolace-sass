import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { CoursesModule } from '../courses/courses.module';
import { ForumModule } from '../forum/forum.module';
import { SecretariatModule } from '../secretariat/secretariat.module';
import { LiveModule } from '../live/live.module';
import { BookingModule } from '../booking/booking.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GrowthModule } from '../growth/growth.module';
import { LiriBrainController } from './liri-brain.controller';
import { LiriBrainService } from './liri-brain.service';
import { BrainToolsService } from './brain-tools.service';

@Module({
  imports: [
    SupabaseModule,
    TenantModule,
    CoursesModule,
    ForumModule,
    SecretariatModule,
    LiveModule,
    BookingModule,
    NotificationsModule,
    GrowthModule,
  ],
  providers: [LiriBrainService, BrainToolsService],
  controllers: [LiriBrainController],
  exports: [LiriBrainService, BrainToolsService],
})
export class LiriBrainModule {}
