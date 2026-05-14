import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import {
  MedosPatientController,
  MedosNoteController,
  MedosPatientMeController,
  MedosFormsController,
  MedosHealthController,
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
    MedosFormsController,
    MedosHealthController,
  ],
})
export class MedosModule {}
