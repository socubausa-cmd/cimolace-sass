import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { ImmersiveLiveService } from './immersive-live.service';
import { ImmersiveLiveController } from './immersive-live.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, LiveKitModule, AiBillingModule],
  providers: [ImmersiveLiveService],
  controllers: [ImmersiveLiveController],
  exports: [ImmersiveLiveService],
})
export class ImmersiveLiveModule {}
