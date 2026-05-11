import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTenantDto } from './create-tenant.dto';
import { CurrentTenant } from './current-tenant.decorator';
import { TenantGuard } from './tenant.guard';
import type { TenantContext } from './tenant.types';
import { TenantService } from './tenant.service';
import { UpdateBrandingDto } from './update-branding.dto';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenantService.createForOwner(user.id, dto);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getCurrent(@CurrentTenant() tenant: TenantContext) {
    return tenant;
  }

  @Patch('current/branding')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  updateBranding(
    @Body() dto: UpdateBrandingDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.tenantService.updateBranding(tenant.id, tenant.userRole, dto);
  }
}
