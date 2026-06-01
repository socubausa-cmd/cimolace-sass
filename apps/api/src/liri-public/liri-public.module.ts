import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SupabaseModule } from '../supabase/supabase.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { MultilangModule } from '../multilang/multilang.module';
import { NeuroRecallModule } from '../neuro-recall/neuro-recall.module';
import { MasterclassFactoryModule } from '../masterclass-factory/masterclass-factory.module';
import { LiriPublicController } from './liri-public.controller';
import { LiriPublicService } from './liri-public.service';
import { WebhookService } from './webhook.service';
import { TranscriptionService } from './transcription.service';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [
    SupabaseModule,
    LiveKitModule,
    MultilangModule,            // → traduction live/replay/vidéo
    NeuroRecallModule,          // → decks/cards spaced repetition
    MasterclassFactoryModule,   // → génération IA masterclass
    JwtModule.register({}),     // → signer embed tokens
  ],
  controllers: [LiriPublicController],
  providers: [LiriPublicService, WebhookService, TranscriptionService, ApiKeyGuard],
  exports: [LiriPublicService, WebhookService, TranscriptionService],
})
export class LiriPublicModule {}
