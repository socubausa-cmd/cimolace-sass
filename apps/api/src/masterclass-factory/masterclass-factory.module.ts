import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { MasterclassFactoryController } from './masterclass-factory.controller';
import { MasterFactoryController } from './master-factory.controller';
import { MasterclassFactoryService } from './masterclass-factory.service';
import { PrecepteurLibraryController } from './precepteur-library.controller';
import { TranscriptCourseService } from './transcript-course.service';
import { CourseJobService } from './course-job.service';
import { ReplayChaptersService } from './replay-chapters.service';
import { SourceAdaptersService } from './source-adapters.service';
import { ComprehensionService } from './comprehension.service';
import { RenderPivotService } from './render-pivot.service';
import { MasterFactoryService } from './master-factory.service';
import { VisualPedagogyService } from './visual-pedagogy.service';
import { SceneAudioService } from './scene-audio.service';
import { PedagogyAiService } from './pedagogy-ai.service';

// ⚠️ Aucun import de module ajouté : ReplayChaptersService ne dépend que de
// SupabaseService (déjà fourni par SupabaseModule) et de ConfigService (module
// global). Une dépendance non résolvable ici fait CRASHER le boot NestJS entier.
// PedagogyAiService suit la même contrainte : ConfigService uniquement.
@Module({
  imports: [SupabaseModule, TenantModule, AiBillingModule],
  providers: [MasterclassFactoryService, MasterFactoryService, TranscriptCourseService, CourseJobService, ReplayChaptersService, SourceAdaptersService, ComprehensionService, RenderPivotService, VisualPedagogyService, SceneAudioService, PedagogyAiService],
  controllers: [MasterclassFactoryController, MasterFactoryController, PrecepteurLibraryController],
  exports: [MasterclassFactoryService, MasterFactoryService, TranscriptCourseService, CourseJobService, ReplayChaptersService, SourceAdaptersService, ComprehensionService, RenderPivotService, VisualPedagogyService, SceneAudioService, PedagogyAiService],
})
export class MasterclassFactoryModule {}
