import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { TenantModule } from "./tenant/tenant.module";
import { MedEhrModule } from "./med-ehr/med-ehr.module";
import { MedNotesModule } from "./med-notes/med-notes.module";
import { MedFormsModule } from "./med-forms/med-forms.module";
import { MedHealthModule } from "./med-health/med-health.module";
import { MedProgramsModule } from "./med-programs/med-programs.module";
import { MedPrescriptionsModule } from "./med-prescriptions/med-prescriptions.module";
import { MedChartingModule } from "./med-charting/med-charting.module";
import { MedGdprModule } from "./med-gdpr/med-gdpr.module";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    MedEhrModule,
    MedNotesModule,
    MedFormsModule,
    MedHealthModule,
    MedProgramsModule,
    MedPrescriptionsModule,
    MedChartingModule,
    MedGdprModule,
  ],
})
export class AppModule {}
