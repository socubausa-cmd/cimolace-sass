import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { AuditResource } from '../decorators/audit-resource.decorator';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import {
  CreatePrescriptionDto,
  CreatePrescriptionItemDto,
} from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { UpdatePrescriptionItemDto } from './dto/update-prescription-item.dto';
import { PrescriptionsService } from './prescriptions.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

// ─── Staff endpoints ─────────────────────────────────────────────────────

@ApiTags('MedOS — Prescriptions')
@ApiBearerAuth()
@Controller('med/prescriptions')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  /** Créer une nouvelle ordonnance en statut draft */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(tenant, req.user.id, dto);
  }

  /** Lister les ordonnances du tenant (filtres optionnels) */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  @AuditResource({ resource: 'prescription', action: 'list' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('patient_id') patientId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list(tenant, {
      patient_id: patientId,
      status,
    });
  }

  /** Lire une ordonnance + ses lignes */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  @AuditResource({ resource: 'prescription', action: 'read', idParam: 'id' })
  get(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.get(tenant, req.user.id, id);
  }

  /** Mettre à jour les méta-infos d'une ordonnance draft */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.update(tenant, req.user.id, id, dto);
  }

  /** Ajouter une ligne (médicament) à une ordonnance draft */
  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  addItem(
    @Param('id') id: string,
    @Body() dto: CreatePrescriptionItemDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.addItem(tenant, req.user.id, id, dto);
  }

  /** Mettre à jour une ligne (médicament) d'une ordonnance draft */
  @Patch(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePrescriptionItemDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.updateItem(tenant, req.user.id, id, itemId, dto);
  }

  /** Supprimer une ligne d'une ordonnance draft */
  @Delete(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.removeItem(tenant, req.user.id, id, itemId);
  }

  /** Signer une ordonnance (immuable ensuite). Génère hash + numéro. */
  @Post(':id/sign')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  sign(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.sign(tenant, req.user.id, id);
  }

  /** Annuler une ordonnance (signed -> cancelled). Reason obligatoire. */
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.cancel(tenant, req.user.id, id, body.reason);
  }
}

// ─── Patient self-service endpoint ───────────────────────────────────────

@ApiTags('MedOS — Patient — Prescriptions')
@ApiBearerAuth()
@Controller('med/me/prescriptions')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class PrescriptionsPatientController {
  constructor(private readonly service: PrescriptionsService) {}

  /** Lister mes ordonnances signées */
  @Get()
  @Roles('patient')
  @AuditResource({ resource: 'prescription', action: 'list' })
  listMine(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.listForCurrentPatient(tenant, req.user.id);
  }
}
