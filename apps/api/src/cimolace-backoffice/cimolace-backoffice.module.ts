import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CimolaceBackofficeController } from './cimolace-backoffice.controller';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
@Module({ imports: [SupabaseModule], providers: [CimolaceBackofficeService], controllers: [CimolaceBackofficeController], exports: [CimolaceBackofficeService] })
export class CimolaceBackofficeModule {}
