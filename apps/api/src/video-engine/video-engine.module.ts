import { Module } from '@nestjs/common';
import { VideoEngineController } from './video-engine.controller';
import { VideoEngineService } from './video-engine.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [VideoEngineController],
  providers: [VideoEngineService],
  exports: [VideoEngineService],
})
export class VideoEngineModule {}
