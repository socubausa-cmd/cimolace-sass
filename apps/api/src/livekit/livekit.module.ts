import { Global, Module } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';

@Global()
@Module({
  providers: [LiveKitService, LiveKitWebhookService],
  controllers: [LiveKitWebhookController],
  exports: [LiveKitService],
})
export class LiveKitModule {}
