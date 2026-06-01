import { Module } from '@nestjs/common';
import { ZoomEngineController } from './zoom-engine.controller';
import { ZoomEngineService } from './zoom-engine.service';
import { ZoomOAuthService } from './zoom-oauth.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ZoomEngineController],
  providers: [ZoomEngineService, ZoomOAuthService],
  exports: [ZoomEngineService, ZoomOAuthService],
})
export class ZoomEngineModule {}
