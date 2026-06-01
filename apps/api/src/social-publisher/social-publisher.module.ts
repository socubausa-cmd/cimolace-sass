import { Module } from '@nestjs/common';
import { SocialPublisherController } from './social-publisher.controller';
import { SocialPublisherService } from './social-publisher.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SocialPublisherController],
  providers: [SocialPublisherService],
  exports: [SocialPublisherService],
})
export class SocialPublisherModule {}
