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
import { MedEhrModule } from './med-ehr/med-ehr.module';
import { MedNotesModule } from './med-notes/med-notes.module';
import { MedFormsModule } from './med-forms/med-forms.module';
import { MedHealthModule } from './med-health/med-health.module';
import { MedProgramsModule } from './med-programs/med-programs.module';
import { MedPrescriptionsModule } from './med-prescriptions/med-prescriptions.module';
import { MedChartingModule } from './med-charting/med-charting.module';
import { MedGdprModule } from './med-gdpr/med-gdpr.module';
import { MedosModule } from './medos/medos.module';

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
  ],
})
export class AppModule {}
