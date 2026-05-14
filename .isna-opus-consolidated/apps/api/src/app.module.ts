import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BookingModule } from './booking/booking.module';
import { ChatEngineModule } from './chat-engine/chat-engine.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CimolaceBackofficeModule } from './cimolace-backoffice/cimolace-backoffice.module';
import { CimolaceCatalogModule } from './cimolace-catalog/cimolace-catalog.module';
import { CourseBuilderModule } from './course-builder/course-builder.module';
import { CoursesModule } from './courses/courses.module';
import { EmailEngineModule } from './email-engine/email-engine.module';
import { ForumModule } from './forum/forum.module';
import { GrowthModule } from './growth/growth.module';
import { HealthController } from './health.controller';
import { IriModule } from './iri/iri.module';
import { LiriBrainModule } from './liri-brain/liri-brain.module';
import { LiveKitModule } from './livekit/livekit.module';
import { LiveModule } from './live/live.module';
import { MarketingModule } from './marketing/marketing.module';
import { MasterclassFactoryModule } from './masterclass-factory/masterclass-factory.module';
import { MboloModule } from './mbolo/mbolo.module';
import { MedosModule } from './medos/medos.module';
import { MessagingModule } from './messaging/messaging.module';
import { NeuroRecallModule } from './neuro-recall/neuro-recall.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PayEngineModule } from './pay-engine/pay-engine.module';
import { ReplayModule } from './replay/replay.module';
import { SecretariatModule } from './secretariat/secretariat.module';
import { SmsEngineModule } from './sms-engine/sms-engine.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TenantModule } from './tenant/tenant.module';
import { VideoEngineModule } from './video-engine/video-engine.module';
import { AiWorkerModule } from './ai-worker/ai-worker.module';
import { StudioModule } from './studio/studio.module';
import { SmartboardModule } from './smartboard/smartboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true,
      envFilePath: [join(__dirname,'..','..','..','.env'),join(__dirname,'..','..','..','.env.local'),join(__dirname,'..','.env'),join(__dirname,'..','.env.local')],
    }),
    SupabaseModule, LiveKitModule, AuthModule, TenantModule, LiveModule, CheckoutModule,
    MarketingModule, CimolaceCatalogModule, MedosModule, BillingModule, LiriBrainModule,
    BookingModule, SecretariatModule, ForumModule, MessagingModule,
    CoursesModule, CimolaceBackofficeModule, NotificationsModule, ReplayModule, GrowthModule,
    EmailEngineModule, SmsEngineModule, PayEngineModule,
    CourseBuilderModule, NeuroRecallModule, MasterclassFactoryModule, ChatEngineModule,
    MboloModule, IriModule,
    VideoEngineModule, AiWorkerModule,
    StudioModule, SmartboardModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
