import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { AirtelModule } from '../airtel/airtel.module';
import { AuthModule } from '../auth/auth.module';
import { CimolaceBackofficeController } from './cimolace-backoffice.controller';
import { BillingModule } from '../billing/billing.module';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { CimolaceStaffGuard } from './cimolace-staff.guard';
import { InfraService } from './infra.service';
import { SchoolOnboardingController } from './school-onboarding.controller';
@Module({ imports: [SupabaseModule, PawaPayModule, AirtelModule, AuthModule, BillingModule], providers: [CimolaceBackofficeService, CimolaceStaffGuard, InfraService], controllers: [CimolaceBackofficeController, SchoolOnboardingController], exports: [CimolaceBackofficeService, InfraService] })
export class CimolaceBackofficeModule {}
