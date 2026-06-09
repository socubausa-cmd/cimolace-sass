import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { LiveKitModule } from './livekit/livekit.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { CimolaceModule } from './cimolace/cimolace.module';
import { CimolaceBackofficeModule } from './cimolace-backoffice/cimolace-backoffice.module';
import { CimolaceCatalogModule } from './cimolace-catalog/cimolace-catalog.module';
import { BillingModule } from './billing/billing.module';
import { CheckoutModule } from './checkout/checkout.module';
import { LiveModule } from './live/live.module';
import { MarketingModule } from './marketing/marketing.module';
import { NotificationsModule } from './notifications/notifications.module';
// ── LIRI School Engines ───────────────────────────────────────────────────────
import { CourseBuilderModule } from './course-builder/course-builder.module';
import { CoursesModule } from './courses/courses.module';
import { BookingModule } from './booking/booking.module';
import { SecretariatModule } from './secretariat/secretariat.module';
import { ForumModule } from './forum/forum.module';
import { SmartResponseModule } from './smart-response/smart-response.module';
import { ImmersiveLiveModule } from './immersive-live/immersive-live.module';
import { ReplayModule } from './replay/replay.module';
import { SmartboardModule } from './smartboard/smartboard.module';
import { StudioModule } from './studio/studio.module';
import { NeuroRecallModule } from './neuro-recall/neuro-recall.module';
import { PayEngineModule } from './pay-engine/pay-engine.module';
import { ChatEngineModule } from './chat-engine/chat-engine.module';
import { MasterclassFactoryModule } from './masterclass-factory/masterclass-factory.module';
import { VideoEngineModule } from './video-engine/video-engine.module';
// ── LIRI IA & Communication ──────────────────────────────────────────────────
import { LiriBrainModule } from './liri-brain/liri-brain.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LongiaModule } from './longia/longia.module';
import { MultilangModule } from './multilang/multilang.module';
import { AiWorkerModule } from './ai-worker/ai-worker.module';
// ── Marketing & Growth ───────────────────────────────────────────────────────
import { IriModule } from './iri/iri.module';
import { GrowthModule } from './growth/growth.module';
// ── Communications (email, SMS, messaging) ───────────────────────────────────
import { EmailEngineModule } from './email-engine/email-engine.module';
import { SmsEngineModule } from './sms-engine/sms-engine.module';
import { MessagingModule } from './messaging/messaging.module';
// ── LIRI Public API (Zoom-level — sites externes, API keys, webhooks) ────────
import { LiriPublicModule } from './liri-public/liri-public.module';
// ── AI Billing (crédits IA — quotas, top-up, usage tracking) ─────────────────
import { AiBillingModule } from './ai-billing/ai-billing.module';
// ── Signup self-serve (création tenant + compte sans login opérateur) ────────
import { SignupModule } from './signup/signup.module';
// ── MedOS ─────────────────────────────────────────────────────────────────────
import { MedosModule } from './medos/medos.module';
// ── Mbolo (e-commerce + live shopping via Liri) ───────────────────────────────
import { MboloModule } from './mbolo/mbolo.module';
// ── Cross-app SSO handoff (med-app → studio immersive room) ───────────────────
import { AuthHandoffModule } from './auth-handoff/auth-handoff.module';
// ── Small ports (4 new modules) ──────────────────────────────────────────────
import { AiUtilsModule } from './ai-utils/ai-utils.module';
import { EmailImapModule } from './email-imap/email-imap.module';
import { TeamInvitesModule } from './team-invites/team-invites.module';
import { PublicReviewsModule } from './public-reviews/public-reviews.module';
import { ZoomEngineModule } from './zoom-engine/zoom-engine.module';
import { SocialPublisherModule } from './social-publisher/social-publisher.module';
// ── School Paths (parcours, cours, modules, semaines, jours, blocs) ───────────
import { SchoolPathsModule } from './school-paths/school-paths.module';

@Module({
  controllers: [HealthController],
  imports: [
    // Global infrastructure (SupabaseService, LiveKit, ConfigService)
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    LiveKitModule,
    // Core domain
    AuthModule,
    TenantModule,
    CimolaceModule,
    CimolaceBackofficeModule,
    CimolaceCatalogModule, // ← FIX : catalogue plans
    BillingModule,
    CheckoutModule,
    LiveModule,
    MarketingModule,
    NotificationsModule,
    // ── École : cours, RDV, secrétariat, forum (FIX bug wiring) ──────────────
    CoursesModule,         // ← FIX : 9 endpoints cours/leçons/progression
    BookingModule,         // ← FIX : 10 endpoints rendez-vous
    SecretariatModule,     // ← FIX : 8 endpoints admin école
    ForumModule,           // ← FIX : 9 endpoints forum classe
    SmartResponseModule,   // ← NEW : 9 endpoints Q&A IA secrétariat (port v1)
    ImmersiveLiveModule,   // ← NEW : 8 endpoints LiveKit companion + AI guide (port v1)
    // ── LIRI School Engines (wired) ─────────────────────────────────────────
    CourseBuilderModule,
    ReplayModule,
    SmartboardModule,
    StudioModule,
    NeuroRecallModule,
    PayEngineModule,
    ChatEngineModule,
    MasterclassFactoryModule, // ← LIRI addon : génération masterclass IA
    VideoEngineModule,        // ← FIX : 6 endpoints gestion assets vidéo
    // ── LIRI IA & Communication (FIX wiring) ─────────────────────────────────
    LiriBrainModule,       // ← FIX : 3 endpoints IA assistant
    KnowledgeModule,       // RAG (gte-small + pgvector) — migration embed-knowledge V1
    LongiaModule,          // ← FIX : 5 endpoints IA temps réel live
    MultilangModule,       // ← FIX : 3 endpoints traduction
    AiWorkerModule,        // ← FIX : 3 endpoints worker IA générique
    // ── Marketing & Growth (FIX wiring) ──────────────────────────────────────
    IriModule,             // ← FIX : 7 endpoints pages vitrines
    GrowthModule,          // ← FIX : 4 endpoints analytics tenant
    // ── Communications (FIX wiring) ──────────────────────────────────────────
    EmailEngineModule,     // ← FIX : 5 endpoints email engine
    SmsEngineModule,       // ← FIX : 3 endpoints SMS
    MessagingModule,       // ← FIX : 5 endpoints chat
    // ── LIRI Public API ──────────────────────────────────────────────────────
    LiriPublicModule,
    // ── AI Billing (LIRI Credits) ────────────────────────────────────────────
    AiBillingModule,
    // ── Signup self-serve (POST /signup/tenant — création tenant publique) ──
    SignupModule,
    // ── MedOS (unified module — EHR, forms, health, prescriptions, programs, charting, gdpr, embedding) ──
    MedosModule,
    // ── Cross-app SSO handoff (one-time code: med-app → studio) ──────────────
    AuthHandoffModule,
    // ── Mbolo (e-commerce + live shopping routed through Liri) ─────────────
    MboloModule,
    // ── Small ports (ai-utils, email-imap, team-invites, public-reviews) ──
    AiUtilsModule,
    EmailImapModule,
    TeamInvitesModule,
    PublicReviewsModule,
    // ── Zoom Engine (cloud recordings → shorts → social) ──────────────────────
    ZoomEngineModule,
    SocialPublisherModule,
    // ── School Paths (parcours pédagogiques + grammaire semaine) ─────────────
    SchoolPathsModule,
  ],
})
export class AppModule {}
