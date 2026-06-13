import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CimolaceBackofficeController } from './cimolace-backoffice.controller';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { CimolaceStaffGuard } from './cimolace-staff.guard';
@Module({ imports: [SupabaseModule], providers: [CimolaceBackofficeService, CimolaceStaffGuard], controllers: [CimolaceBackofficeController], exports: [CimolaceBackofficeService] })
export class CimolaceBackofficeModule {}
