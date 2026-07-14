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
  MedosFormAssignmentsController,
  MedosHealthController,
} from './medos.controller';
import { MedChartingController } from './med-charting.controller';
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedosService } from './medos.service';
import { MedChartingService } from './med-charting.service';
import { MedPrescriptionSuggestionService } from './prescription-suggestion/med-prescription-suggestion.service';
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
import { PrescriptionsPdfService } from './prescriptions/prescriptions-pdf.service';
import {
  AppointmentsController,
  AvailabilityController,
} from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { MedosBookingController } from './appointments/booking.controller';
import { MedosGuestBookingController } from './appointments/guest-booking.controller';
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
import {
  TeleconsultController,
  TeleconsultInvitePublicController,
} from './teleconsult/teleconsult.controller';
import { TeleconsultService } from './teleconsult/teleconsult.service';
import { AttachmentsController } from './attachments/attachments.controller';
import { AttachmentsService } from './attachments/attachments.service';
import { GdprController } from './gdpr/gdpr.controller';
import { GdprService } from './gdpr/gdpr.service';
import { MedAuditController } from './audit/med-audit.controller';
import { MedAuditService } from './audit/med-audit.service';
import {
  InvitationsController,
  InvitationsPublicController,
} from './invitations/invitations.controller';
import { InvitationsService } from './invitations/invitations.service';
// MEDOS v2 — Bio Digital Twin
import { TwinController } from './twin/twin.controller';
import { TwinMeController } from './twin/twin-me.controller';
import { TwinUsageController } from './twin/twin-usage.controller';
import { TwinService } from './twin/twin.service';
import { TwinScoringService } from './twin/twin-scoring.service';
import { TwinAiService } from './twin/twin-ai.service';
import { TwinSimulationService } from './twin/twin-simulation.service';
import { TwinProjectionService } from './twin/twin-projection.service';
import { TwinGenomicsService } from './twin/twin-genomics.service';
import { TwinMicrobiomeService } from './twin/twin-microbiome.service';
import { TwinMetabolomicsService } from './twin/twin-metabolomics.service';
import { TwinEnabledGuard } from './twin/twin-enabled.guard';
// MEDOS — Façade FHIR R4 (interopérabilité hôpital/DMP, lecture seule)
import { FhirController } from './fhir/fhir.controller';
import { FhirService } from './fhir/fhir.service';
// MEDOS routes all video through Liri (LiveModule). We don't import
// LiveKitModule directly anymore — that would re-introduce the bypass
// the P5 refactor specifically eliminated.
import { LiveModule } from '../live/live.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailEngineModule } from '../email-engine/email-engine.module';

@Module({
  imports: [
    TenantModule,
    LiveModule, // Liri — single authority for all video sessions
    NotificationsModule, // in-app notifications (form assign / message / note share)
    EmailEngineModule, // emails transactionnels par tenant (invitation, etc.)
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
    MedPrescriptionSuggestionService,
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
    PrescriptionsPdfService,
    AppointmentsService,
    MessagingService,
    ProgramsService,
    ClinicalListsService,
    TeleconsultService,
    AttachmentsService,
    GdprService,
    InvitationsService,
    // Audit log viewer (admin)
    MedAuditService,
    // Bio Digital Twin (v2)
    TwinService,
    TwinScoringService,
    TwinAiService,
    TwinSimulationService,
    TwinProjectionService,
    TwinGenomicsService,
    TwinMicrobiomeService,
    TwinMetabolomicsService,
    TwinEnabledGuard,
    // FHIR R4 facade (read-only interoperability)
    FhirService,
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
    // Broad '/med' controller — registered AFTER the specific ones above so
    // that med/patients/* and med/forms/* keep priority over its routes.
    MedosFormAssignmentsController,
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
    MedosBookingController,
    MedosGuestBookingController,
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
    TeleconsultInvitePublicController,
    // Attachments
    AttachmentsController,
    // GDPR
    GdprController,
    // Audit log viewer (admin)
    MedAuditController,
    // Invitations
    InvitationsController,
    InvitationsPublicController,
    // Bio Digital Twin (v2)
    TwinController,
    TwinMeController,
    TwinUsageController,
    // FHIR R4 facade (read-only) — registered last; '/med/fhir/*' is
    // a distinct, unambiguous prefix so route ordering doesn't matter.
    FhirController,
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
