import {
  Body,
  Controller,
  Delete,
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
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dto/invitations.dto';
import { InvitationsService } from './invitations.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

// ─── Staff endpoints (auth required) ──────────────────────────────────────

@ApiTags('MedOS — Invitations patient')
@ApiBearerAuth()
@Controller('med/invitations')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  create(
    @Body() dto: CreateInvitationDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(tenant, req.user.id, dto);
  }

  @Get()
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('status') status?: string,
  ) {
    return this.service.list(tenant, status);
  }

  @Post(':id/resend')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  resend(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.resend(tenant, id);
  }

  @Delete(':id')
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  cancel(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.service.cancel(tenant, id);
  }
}

// ─── Public endpoint pour acceptation (pas d'auth) ────────────────────────

@ApiTags('MedOS — Invitations (public)')
@Controller('med/invitations-public')
export class InvitationsPublicController {
  constructor(private readonly service: InvitationsService) {}

  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto);
  }
}
