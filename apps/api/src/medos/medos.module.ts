import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import {
  MedosPatientController,
  MedosNoteController,
  MedosPatientMeController,
  // MedosFormsController,    // Phase 1B — désactivé
  // MedosHealthController,   // Phase 1B — désactivé
} from './medos.controller';
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedosService } from './medos.service';

@Module({
  imports: [TenantModule],
  providers: [MedosService, MedosEnabledGuard],
  controllers: [
    MedosPatientController,
    MedosNoteController,
    MedosPatientMeController,
    // MedosFormsController,   // Phase 1B — désactivé
    // MedosHealthController,  // Phase 1B — désactivé
  ],
})
export class MedosModule {}
