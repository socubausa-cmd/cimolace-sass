import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { TwinEnabledGuard } from './twin-enabled.guard';
import { TwinService } from './twin.service';

type AuthRequest = Request & { user: { id: string; email?: string } };

/**
 * Portail patient — vue lecture seule "Mon corps" (Chantier 4).
 *
 * Endpoint dédié, séparé de TwinController pour éviter la collision
 * avec les routes paramétrées `:patientId`. Garde par rôle 'patient'
 * uniquement (le staff utilise /med/twin/:patientId/state).
 */
@ApiTags('MedOS — Bio Digital Twin (patient view)')
@ApiBearerAuth()
@Controller('med/twin-me')
@UseGuards(
  JwtAuthGuard,
  TenantGuard,
  MedosEnabledGuard,
  TwinEnabledGuard,
  RolesGuard,
)
export class TwinMeController {
  constructor(private readonly service: TwinService) {}

  /** État du jumeau du patient connecté (organes, roue, events, alertes). */
  @Get('state')
  @Roles('patient')
  state(@CurrentTenant() tenant: TenantContext, @Req() req: AuthRequest) {
    return this.service.getMyTwinState(tenant, req.user.id);
  }
}
