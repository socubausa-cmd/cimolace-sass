import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TenantModule } from '../tenant/tenant.module';
import {
  MedosPatientController,
  MedosNoteController,
  MedosPatientMeController,
  MedosFormsController,
  MedosHealthController,
} from './medos.controller';
import { MedChartingController } from './med-charting.controller';
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedosService } from './medos.service';
import { MedChartingService } from './med-charting.service';
import { MedAuditInterceptor } from './med-audit.interceptor';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeysService } from './api-keys/api-keys.service';
import { MedosEmbedController } from './embed/embed.controller';
import { MedosEmbedDataController } from './embed/embed-data.controller';
import { EmbedService } from './embed/embed.service';
import { EmbedTokenGuard } from './embed/embed-token.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CimolaceStaffGuard } from '../cimolace-backoffice/cimolace-staff.guard';
import { TenantDomainsController } from './tenant-domains/tenant-domains.controller';
import { TenantDomainsService } from './tenant-domains/tenant-domains.service';
import {
  PrescriptionsController,
  PrescriptionsPatientController,
} from './prescriptions/prescriptions.controller';
import { PrescriptionsService } from './prescriptions/prescriptions.service';
import {
  AppointmentsController,
  AvailabilityController,
} from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { MessagingController } from './messaging/messaging.controller';
import { MessagingService } from './messaging/messaging.service';
import {
  EnrollmentsController,
  ProgramsController,
} from './programs/programs.controller';
import { ProgramsService } from './programs/programs.service';
import {
  AllergiesController,
  ImmunizationsController,
  LabResultsController,
  MedicationsController,
  ProblemsController,
} from './clinical/clinical.controller';
import { ClinicalListsService } from './clinical/clinical.service';
import { TeleconsultController } from './teleconsult/teleconsult.controller';
import { TeleconsultService } from './teleconsult/teleconsult.service';
import { AttachmentsController } from './attachments/attachments.controller';
import { AttachmentsService } from './attachments/attachments.service';
import { GdprController } from './gdpr/gdpr.controller';
import { GdprService } from './gdpr/gdpr.service';
import {
  InvitationsController,
  InvitationsPublicController,
} from './invitations/invitations.controller';
import { InvitationsService } from './invitations/invitations.service';

@Module({
  imports: [
    TenantModule,
    // JwtModule pour signer/vérifier les embed-tokens (15 min lifetime).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('MEDOS_EMBED_JWT_SECRET') ?? 'dev-secret',
      }),
    }),
  ],
  providers: [
    // Core
    MedosService,
    MedosEnabledGuard,
    MedChartingService,
    MedAuditInterceptor,
    // Embedding
    ApiKeysService,
    EmbedService,
    EmbedTokenGuard,
    ApiKeyGuard,
    CimolaceStaffGuard,
    TenantDomainsService,
    // Clinical modules
    PrescriptionsService,
    AppointmentsService,
    MessagingService,
    ProgramsService,
    ClinicalListsService,
    TeleconsultService,
    AttachmentsService,
    GdprService,
    InvitationsService,
    // Global audit interceptor (court-circuite hors MEDOS)
    {
      provide: APP_INTERCEPTOR,
      useClass: MedAuditInterceptor,
    },
  ],
  controllers: [
    // Core MEDOS (Phase 1)
    MedosPatientController,
    MedosNoteController,
    MedosPatientMeController,
    MedosFormsController,
    MedosHealthController,
    MedChartingController,
    // Embedding & integration
    ApiKeysController,
    MedosEmbedController,
    MedosEmbedDataController,
    TenantDomainsController,
    // Prescriptions
    PrescriptionsController,
    PrescriptionsPatientController,
    // Appointments
    AvailabilityController,
    AppointmentsController,
    // Messaging
    MessagingController,
    // Programs
    ProgramsController,
    EnrollmentsController,
    // Clinical lists
    AllergiesController,
    MedicationsController,
    ProblemsController,
    ImmunizationsController,
    LabResultsController,
    // Teleconsult
    TeleconsultController,
    // Attachments
    AttachmentsController,
    // GDPR
    GdprController,
    // Invitations
    InvitationsController,
    InvitationsPublicController,
  ],
  exports: [
    ApiKeyGuard,
    EmbedTokenGuard,
    ApiKeysService,
    EmbedService,
    TenantDomainsService,
    PrescriptionsService,
    AppointmentsService,
    MessagingService,
    ProgramsService,
    ClinicalListsService,
    TeleconsultService,
    AttachmentsService,
    GdprService,
    InvitationsService,
  ],
})
export class MedosModule {}
