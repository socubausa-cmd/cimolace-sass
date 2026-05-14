import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { TenantModule } from "./tenant/tenant.module";
import { CimolaceModule } from "./cimolace/cimolace.module";
import { BillingModule } from "./billing/billing.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { LiveModule } from "./live/live.module";
import { MarketingModule } from "./marketing/marketing.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MedEhrModule } from "./med-ehr/med-ehr.module";
import { MedNotesModule } from "./med-notes/med-notes.module";
import { MedFormsModule } from "./med-forms/med-forms.module";
import { MedHealthModule } from "./med-health/med-health.module";
import { MedProgramsModule } from "./med-programs/med-programs.module";
import { MedPrescriptionsModule } from "./med-prescriptions/med-prescriptions.module";
import { MedChartingModule } from "./med-charting/med-charting.module";
import { MedGdprModule } from "./med-gdpr/med-gdpr.module";

@Module({
  controllers: [HealthController],
  imports: [
    AuthModule, TenantModule,
    CimolaceModule, BillingModule, CheckoutModule,
    LiveModule, MarketingModule, NotificationsModule,
    MedEhrModule, MedNotesModule, MedFormsModule,
    MedHealthModule, MedProgramsModule, MedPrescriptionsModule,
    MedChartingModule, MedGdprModule,
  ],
})
export class AppModule {}
