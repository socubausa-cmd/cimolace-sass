import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { ClinicalListsService, ClinicalTable } from './clinical.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

/**
 * Génère un controller pour une table clinique donnée.
 * On crée 5 controllers concrets (un par ressource) en sous-classes minimales,
 * pour avoir des routes propres et un Swagger tags clair.
 */
function makeClinicalController(
  table: ClinicalTable,
  routePath: string,
  tagLabel: string,
) {
  @ApiTags(tagLabel)
  @ApiBearerAuth()
  @Controller(routePath)
  @UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
  class ClinicalController {
    constructor(public readonly service: ClinicalListsService) {}

    @Post()
    @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
    create(
      @Body() body: Record<string, unknown>,
      @CurrentTenant() tenant: TenantContext,
      @Req() req: AuthRequest,
    ) {
      return this.service.create(
        table,
        tenant,
        req.user.id,
        tenant.userRole,
        body,
      );
    }

    @Get('patient/:patientId')
    @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
    listForPatient(
      @Param('patientId') patientId: string,
      @CurrentTenant() tenant: TenantContext,
      @Req() req: AuthRequest,
    ) {
      return this.service.listForPatient(
        table,
        tenant,
        req.user.id,
        tenant.userRole,
        patientId,
      );
    }

    @Patch(':id')
    @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
    update(
      @Param('id') id: string,
      @Body() body: Record<string, unknown>,
      @CurrentTenant() tenant: TenantContext,
      @Req() req: AuthRequest,
    ) {
      return this.service.update(
        table,
        tenant,
        req.user.id,
        tenant.userRole,
        id,
        body,
      );
    }

    @Delete(':id')
    @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
    remove(
      @Param('id') id: string,
      @CurrentTenant() tenant: TenantContext,
      @Req() req: AuthRequest,
    ) {
      return this.service.remove(
        table,
        tenant,
        req.user.id,
        tenant.userRole,
        id,
      );
    }
  }
  return ClinicalController;
}

export const AllergiesController = makeClinicalController(
  'med_allergies',
  'med/allergies',
  'MedOS — Allergies',
);
export const MedicationsController = makeClinicalController(
  'med_medications',
  'med/medications',
  'MedOS — Médicaments',
);
export const ProblemsController = makeClinicalController(
  'med_problems',
  'med/problems',
  'MedOS — Diagnostics & problèmes',
);
export const ImmunizationsController = makeClinicalController(
  'med_immunizations',
  'med/immunizations',
  'MedOS — Vaccinations',
);
export const LabResultsController = makeClinicalController(
  'med_lab_results',
  'med/lab-results',
  'MedOS — Résultats labo',
);
