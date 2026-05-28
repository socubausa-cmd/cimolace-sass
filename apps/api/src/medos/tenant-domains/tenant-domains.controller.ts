import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CimolaceStaffGuard } from '../../cimolace-backoffice/cimolace-staff.guard';
import { TenantDomainsService } from './tenant-domains.service';

type AuthRequest = Request & { user: { id: string; email?: string } };
type AddDomainDto = {
  domain: string;
  usage?: 'embed_origin' | 'custom_host';
};

/**
 * Admin Cimolace — gestion des domaines tenant.
 *
 * Sert deux cas d'usage :
 *  - `embed_origin` : autorise un site externe (ex: zahirwellness.com) à charger
 *    le widget MEDOS et obtenir des embed-tokens.
 *  - `custom_host` : Mode B — Cimolace sert l'expérience MEDOS sous le domaine
 *    du client (provisioning SSL géré en S5).
 *
 * Accès restreint au staff Cimolace (CimolaceStaffGuard).
 */
@ApiTags('Cimolace Admin — Tenant Domains')
@ApiBearerAuth()
@Controller('admin/tenants/:tenantId/domains')
@UseGuards(JwtAuthGuard, CimolaceStaffGuard)
export class TenantDomainsController {
  constructor(private readonly domainsService: TenantDomainsService) {}

  @Post()
  async add(
    @Param('tenantId') tenantId: string,
    @Body() dto: AddDomainDto,
    @Req() req: AuthRequest,
  ) {
    return this.domainsService.add(tenantId, dto, req.user.id);
  }

  @Get()
  async list(@Param('tenantId') tenantId: string) {
    return this.domainsService.list(tenantId);
  }

  @Delete(':domainId')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('domainId') domainId: string,
  ) {
    return this.domainsService.revoke(tenantId, domainId);
  }
}
