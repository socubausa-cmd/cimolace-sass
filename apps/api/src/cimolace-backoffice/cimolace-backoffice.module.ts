import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { AirtelModule } from '../airtel/airtel.module';
import { CimolaceBackofficeController } from './cimolace-backoffice.controller';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { CimolaceStaffGuard } from './cimolace-staff.guard';
import { SchoolOnboardingController } from './school-onboarding.controller';
@Module({ imports: [SupabaseModule, PawaPayModule, AirtelModule], providers: [CimolaceBackofficeService, CimolaceStaffGuard], controllers: [CimolaceBackofficeController, SchoolOnboardingController], exports: [CimolaceBackofficeService] })
export class CimolaceBackofficeModule {}
