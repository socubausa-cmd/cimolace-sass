import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { LiveKitModule } from './livekit/livekit.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { CimolaceModule } from './cimolace/cimolace.module';
import { CimolaceBackofficeModule } from './cimolace-backoffice/cimolace-backoffice.module';
import { BillingModule } from './billing/billing.module';
import { CheckoutModule } from './checkout/checkout.module';
import { LiveModule } from './live/live.module';
import { MarketingModule } from './marketing/marketing.module';
import { NotificationsModule } from './notifications/notifications.module';
// ── LIRI School Engines ───────────────────────────────────────────────────────
import { CourseBuilderModule } from './course-builder/course-builder.module';
import { ReplayModule } from './replay/replay.module';
import { SmartboardModule } from './smartboard/smartboard.module';
import { StudioModule } from './studio/studio.module';
import { NeuroRecallModule } from './neuro-recall/neuro-recall.module';
import { PayEngineModule } from './pay-engine/pay-engine.module';
import { ChatEngineModule } from './chat-engine/chat-engine.module';
// ── LIRI Public API (Zoom-level — sites externes, API keys, webhooks) ────────
import { LiriPublicModule } from './liri-public/liri-public.module';
// ── AI Billing (crédits IA — quotas, top-up, usage tracking) ─────────────────
import { AiBillingModule } from './ai-billing/ai-billing.module';
// ── MedOS ─────────────────────────────────────────────────────────────────────
import { MedEhrModule } from './med-ehr/med-ehr.module';
import { MedNotesModule } from './med-notes/med-notes.module';
import { MedFormsModule } from './med-forms/med-forms.module';
import { MedHealthModule } from './med-health/med-health.module';
import { MedProgramsModule } from './med-programs/med-programs.module';
import { MedPrescriptionsModule } from './med-prescriptions/med-prescriptions.module';
import { MedChartingModule } from './med-charting/med-charting.module';
import { MedGdprModule } from './med-gdpr/med-gdpr.module';
import { MedosModule } from './medos/medos.module';
// ── Mbolo (e-commerce + live shopping via Liri) ───────────────────────────────
import { MboloModule } from './mbolo/mbolo.module';

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
    BillingModule,
    CheckoutModule,
    LiveModule,
    MarketingModule,
    NotificationsModule,
    // ── LIRI School Engines (wired) ─────────────────────────────────────────
    CourseBuilderModule,
    ReplayModule,
    SmartboardModule,
    StudioModule,
    NeuroRecallModule,
    PayEngineModule,
    ChatEngineModule,
    // ── LIRI Public API ──────────────────────────────────────────────────────
    LiriPublicModule,
    // ── AI Billing (LIRI Credits) ────────────────────────────────────────────
    AiBillingModule,
    // ── MedOS ────────────────────────────────────────────────────────────────
    // Legacy MEDOS sub-modules (kept for backward compat, parallel to MedosModule)
    MedEhrModule,
    MedNotesModule,
    MedFormsModule,
    MedHealthModule,
    MedProgramsModule,
    MedPrescriptionsModule,
    MedChartingModule,
    MedGdprModule,
    // New unified MEDOS module (embedding + 8 wired modules)
    MedosModule,
    // ── Mbolo (e-commerce + live shopping routed through Liri) ─────────────
    MboloModule,
  ],
})
export class AppModule {}
