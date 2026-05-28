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
import { MedosEnabledGuard } from '../medos-enabled.guard';
import {
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from './dto/attachments.dto';
import { AttachmentsService } from './attachments.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

@ApiTags('MedOS — Pièces jointes')
@ApiBearerAuth()
@Controller('med/attachments')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  /** Obtenir une URL signée pour upload direct vers Supabase Storage */
  @Post('upload-url')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  getUploadUrl(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Body() body: { bucket?: string },
  ) {
    return this.service.createUploadUrl(tenant, req.user.id, body.bucket);
  }

  /** Enregistrer les métadonnées du fichier uploadé */
  @Post()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  register(
    @Body() dto: CreateAttachmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.register(tenant, req.user.id, tenant.userRole, dto);
  }

  /** Lister par propriétaire (note, prescription, etc.) */
  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  listByOwner(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('owner_type') ownerType: string,
    @Query('owner_id') ownerId: string,
  ) {
    return this.service.listByOwner(
      tenant,
      req.user.id,
      tenant.userRole,
      ownerType,
      ownerId,
    );
  }

  /** Lister toutes les pièces d'un patient */
  @Get('patient/:patientId')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  listForPatient(
    @Param('patientId') patientId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.listForPatient(
      tenant,
      req.user.id,
      tenant.userRole,
      patientId,
    );
  }

  /** URL signée pour télécharger un fichier (1h validité) */
  @Get(':id/download-url')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.signedDownloadUrl(
      tenant,
      req.user.id,
      tenant.userRole,
      id,
    );
  }

  @Patch(':id')
  @Roles('owner', 'practitioner', 'clinic_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAttachmentDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.update(tenant, req.user.id, tenant.userRole, id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'practitioner', 'clinic_admin', 'patient')
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.softDelete(tenant, req.user.id, tenant.userRole, id);
  }
}
