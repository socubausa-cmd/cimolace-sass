import { Global, Module } from '@nestjs/common';
import { LiveKitService } from './livekit.service';

/**
 * Bare-bones LiveKit driver. Webhook handling moved to LiveModule so the
 * webhook can dispatch to Liri (closing liri_sessions on room_finished) —
 * keeping it here would create a circular dep (LiveKitWebhookService needs
 * LiveService, LiveModule already imports LiveKitModule).
 */
@Global()
@Module({
  providers: [LiveKitService],
  exports: [LiveKitService],
})
export class LiveKitModule {}
