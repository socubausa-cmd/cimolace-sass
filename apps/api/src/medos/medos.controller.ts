import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CreateFormDto } from './dto/create-form.dto';
import { AuditResource } from './decorators/audit-resource.decorator';
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedosService } from './medos.service';

interface AuthRequest extends Request {
  user: { id: string; email?: string };
}

// ---------------------------------------------------------------------------
// Patients — RBAC: practitioner, clinic_admin, receptionist (CRUD with limits)
// ---------------------------------------------------------------------------

@ApiTags('MedOS — Patients')
@ApiBearerAuth()
@Controller('med/patients')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosPatientController {
  constructor(private readonly medosService: MedosService) {}

  /** Créer un dossier patient — audit géré au niveau service (med_patient/create) */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  create(
    @Body() dto: CreatePatientDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createPatient(tenant, req.user.id, dto);
  }

  /** Lister tous les patients du tenant — pas d'audit service-level, on couvre via interceptor */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  @AuditResource({ resource: 'patient', action: 'list' })
  list(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listPatients(tenant);
  }

  /** Voir un dossier patient — audit géré au niveau service (med_patient/view) */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  get(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.getPatient(tenant, req.user.id, id);
  }

  /** Mettre à jour un dossier patient — audit géré au niveau service (med_patient/update) */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.updatePatient(tenant, req.user.id, id, dto);
  }

  /** Lister les notes d'un patient — pas d'audit service-level, on couvre via interceptor */
  @Get(':id/notes')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  @AuditResource({ resource: 'note', action: 'list', idParam: 'id' })
  listNotes(
    @Param('id') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.listNotes(tenant, patientId);
  }

  /** Créer une note de consultation pour un patient — audit géré au niveau service */
  @Post(':id/notes')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  createNote(
    @Param('id') patientId: string,
    @Body() dto: CreateNoteDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createNote(tenant, req.user.id, patientId, dto);
  }
}

// ---------------------------------------------------------------------------
// Notes — opérations sur une note existante (sign, share, update)
// ---------------------------------------------------------------------------

@ApiTags('MedOS — Notes')
@ApiBearerAuth()
@Controller('med/notes')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class MedosNoteController {
  constructor(private readonly medosService: MedosService) {}

  /** Modifier une note non signée — audit géré au niveau service */
  @Patch(':id')
  @Roles('owner', 'practitioner', 'clinic_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.updateNote(tenant, req.user.id, id, dto);
  }

  /** Signer une note — audit géré au niveau service */
  @Post(':id/sign')
  @Roles('owner', 'practitioner', 'clinic_admin')
  sign(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.signNote(tenant, req.user.id, id);
  }

  /** Partager / dépublier une note — audit géré au niveau service */
  @Post(':id/share')
  @Roles('owner', 'practitioner', 'clinic_admin')
  share(
    @Param('id') id: string,
    @Body('is_shared') isShared: boolean,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.shareNote(tenant, req.user.id, id, isShared);
  }
}

// ---------------------------------------------------------------------------
// Patient self-service — accès aux notes partagées
// ---------------------------------------------------------------------------

@Controller('med/me')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class MedosPatientMeController {
  constructor(private readonly medosService: MedosService) {}

  /** Lister les notes partagées du patient connecté */
  @Get('notes')
  @Roles('patient')
  @AuditResource({ resource: 'note', action: 'list' })
  listMySharedNotes(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.listPatientSharedNotes(tenant, req.user.id);
  }

  /** Confirmer la lecture d'une note partagée — audit géré au niveau service */
  @Post('notes/:id/read')
  @Roles('patient')
  markSharedNoteRead(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.markSharedNoteRead(tenant, req.user.id, id);
  }

  /** Lister les entrées du journal santé du patient connecté */
  @Get('health')
  @Roles('patient')
  @AuditResource({ resource: 'health_entry', action: 'list' })
  listMyHealthEntries(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.listMyHealthEntries(tenant, req.user.id);
  }

  /** Créer une entrée du journal santé pour le patient connecté */
  @Post('health')
  @Roles('patient')
  createMyHealthEntry(
    @Body() dto: Record<string, unknown>,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createMyHealthEntry(tenant, req.user.id, dto);
  }

  /** Lister les formulaires disponibles pour le patient connecté */
  @Get('forms')
  @Roles('patient')
  @AuditResource({ resource: 'form', action: 'list' })
  listMyForms(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listMyForms(tenant);
  }

  /** Soumettre une réponse à un formulaire (patient self-service) */
  @Post('forms/:id/responses')
  @Roles('patient')
  submitMyFormResponse(
    @Param('id') formId: string,
    @Body() body: { responses: Record<string, unknown> },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.submitMyFormResponse(
      tenant,
      req.user.id,
      formId,
      body?.responses ?? {},
    );
  }
}

// ---------------------------------------------------------------------------
// Forms — formulaires médicaux
// ---------------------------------------------------------------------------

@ApiTags('MedOS — Formulaires')
@ApiBearerAuth()
@Controller('med/forms')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosFormsController {
  constructor(private readonly medosService: MedosService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  @AuditResource({ resource: 'form', action: 'list' })
  listForms(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listForms(tenant);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  @AuditResource({ resource: 'form', action: 'read', idParam: 'id' })
  getForm(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.medosService.getForm(tenant, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  createForm(
    @Body() dto: CreateFormDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createForm(
      tenant,
      req.user.id,
      dto as unknown as Record<string, unknown>,
    );
  }

  @Post(':id/responses')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  submitResponse(
    @Param('id') formId: string,
    @Body() dto: { patient_id: string; responses: Record<string, unknown> },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.submitFormResponse(
      tenant,
      req.user.id,
      formId,
      dto,
    );
  }

  @Get(':id/responses')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  @AuditResource({ resource: 'form_response', action: 'list', idParam: 'id' })
  getResponses(
    @Param('id') formId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.getFormResponses(tenant, formId);
  }
}

// ---------------------------------------------------------------------------
// Health — journal santé
// ---------------------------------------------------------------------------

@ApiTags('MedOS — Santé')
@ApiBearerAuth()
@Controller('med/health')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosHealthController {
  constructor(private readonly medosService: MedosService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  createEntry(
    @Body() dto: Record<string, unknown>,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createHealthEntry(tenant, req.user.id, dto);
  }

  @Get('patient/:patientId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  @AuditResource({ resource: 'health_entry', action: 'list', idParam: 'patientId' })
  getEntries(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.getHealthEntries(tenant, patientId);
  }
}
