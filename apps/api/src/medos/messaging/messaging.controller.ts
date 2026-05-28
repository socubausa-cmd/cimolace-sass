import {
  Body,
  Controller,
  Get,
  Param,
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
  CloseThreadDto,
  CreateThreadDto,
  SendMessageDto,
} from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

@ApiTags('MedOS — Messagerie')
@ApiBearerAuth()
@Controller('med/threads')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Post()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  createThread(
    @Body() dto: CreateThreadDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.createThread(tenant, req.user.id, tenant.userRole, dto);
  }

  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  listThreads(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('status') status?: string,
    @Query('patient_id') patientId?: string,
  ) {
    return this.service.listThreads(tenant, req.user.id, tenant.userRole, {
      status,
      patient_id: patientId,
    });
  }

  @Get(':id')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  getThread(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.getThread(tenant, req.user.id, tenant.userRole, id);
  }

  @Post(':id/close')
  @Roles('owner', 'practitioner', 'clinic_admin')
  closeThread(
    @Param('id') id: string,
    @Body() dto: CloseThreadDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.closeThread(tenant, req.user.id, id, dto);
  }

  @Post(':id/messages')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  send(
    @Param('id') threadId: string,
    @Body() dto: SendMessageDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.send(tenant, req.user.id, tenant.userRole, threadId, dto);
  }

  @Get(':id/messages')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  listMessages(
    @Param('id') threadId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.listMessages(tenant, req.user.id, tenant.userRole, threadId);
  }

  @Post(':id/messages/:messageId/read')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist', 'patient')
  markRead(
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.markRead(
      tenant,
      req.user.id,
      tenant.userRole,
      threadId,
      messageId,
    );
  }
}
