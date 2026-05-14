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
import { MedosEnabledGuard } from './medos-enabled.guard';
import { MedosService } from './medos.service';

interface AuthRequest extends Request {
  user: { id: string; email?: string };
}

// ---------------------------------------------------------------------------
// Patients — RBAC: practitioner, clinic_admin, receptionist (CRUD with limits)
// ---------------------------------------------------------------------------

@Controller('med/patients')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosPatientController {
  constructor(private readonly medosService: MedosService) {}

  /** Créer un dossier patient */
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

  /** Lister tous les patients du tenant */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listPatients(tenant);
  }

  /** Voir un dossier patient */
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

  /** Mettre à jour un dossier patient */
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

  /** Lister les notes d'un patient */
  @Get(':id/notes')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  listNotes(
    @Param('id') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.listNotes(tenant, patientId);
  }

  /** Créer une note de consultation pour un patient */
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

@Controller('med/notes')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class MedosNoteController {
  constructor(private readonly medosService: MedosService) {}

  /** Modifier une note non signée */
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

  /** Signer une note (verrouillage) */
  @Post(':id/sign')
  @Roles('owner', 'practitioner', 'clinic_admin')
  sign(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.signNote(tenant, req.user.id, id);
  }

  /** Partager / dépublier une note au patient */
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
  listMySharedNotes(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.listPatientSharedNotes(tenant, req.user.id);
  }

  /** Confirmer la lecture d'une note partagée */
  @Post('notes/:id/read')
  @Roles('patient')
  markSharedNoteRead(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.markSharedNoteRead(tenant, req.user.id, id);
  }
}

// ---------------------------------------------------------------------------
// Forms — formulaires médicaux
// ---------------------------------------------------------------------------

@Controller('med/forms')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosFormsController {
  constructor(private readonly medosService: MedosService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  listForms(@CurrentTenant() tenant: TenantContext) {
    return this.medosService.listForms(tenant);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  getForm(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.medosService.getForm(tenant, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  createForm(
    @Body() dto: Record<string, unknown>,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.medosService.createForm(tenant, req.user.id, dto);
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
    return this.medosService.submitFormResponse(tenant, req.user.id, formId, dto);
  }

  @Get(':id/responses')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
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
  getEntries(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.medosService.getHealthEntries(tenant, patientId);
  }
}
