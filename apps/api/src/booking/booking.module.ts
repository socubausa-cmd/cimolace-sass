import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingAdvancedController } from './booking-advanced.controller';
import { BookingAdvancedService } from './booking-advanced.service';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, LiveModule, NotificationsModule],
  providers: [BookingService, BookingAdvancedService],
  controllers: [BookingController, BookingAdvancedController],
  exports: [BookingService, BookingAdvancedService],
})
export class BookingModule {}
