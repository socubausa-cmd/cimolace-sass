import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { MasterclassFactoryController } from './masterclass-factory.controller';
import { MasterclassFactoryService } from './masterclass-factory.service';
import { PrecepteurLibraryController } from './precepteur-library.controller';
import { TranscriptCourseService } from './transcript-course.service';

@Module({
  imports: [SupabaseModule, TenantModule, AiBillingModule],
  providers: [MasterclassFactoryService, TranscriptCourseService],
  controllers: [MasterclassFactoryController, PrecepteurLibraryController],
  exports: [MasterclassFactoryService, TranscriptCourseService],
})
export class MasterclassFactoryModule {}
