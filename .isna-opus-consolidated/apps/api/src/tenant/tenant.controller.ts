import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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

  @Post() @UseGuards(JwtAuthGuard) create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) { return this.tenantService.createForOwner(user.id, dto); }
  @Get('current') @UseGuards(JwtAuthGuard, TenantGuard) getCurrent(@CurrentTenant() tenant: TenantContext) { return tenant; }
  @Patch('current/branding') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') updateBranding(@Body() dto: UpdateBrandingDto, @CurrentTenant() tenant: TenantContext) { return this.tenantService.updateBranding(tenant.id, tenant.userRole, dto); }
  @Get('mine') @UseGuards(JwtAuthGuard) getMyTenants(@CurrentUser() user: AuthUser) { return this.tenantService.getMyTenants(user.id); }

  // ── Members ──────────────────────────────────────────────────────────────
  @Get('current/members') @UseGuards(JwtAuthGuard, TenantGuard) listMembers(@CurrentTenant() t: TenantContext) { return this.tenantService.listMembers(t.id); }
  @Post('current/members') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') inviteMember(@Body('email') email: string, @Body('role') role: string, @CurrentTenant() t: TenantContext) { return this.tenantService.inviteMember(t.id, email, role ?? 'student'); }
  @Patch('current/members/:userId') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') updateMemberRole(@Param('userId') uid: string, @Body('role') role: string, @CurrentTenant() t: TenantContext) { return this.tenantService.updateMemberRole(t.id, uid, role); }
  @Delete('current/members/:userId') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') removeMember(@Param('userId') uid: string, @CurrentTenant() t: TenantContext) { return this.tenantService.removeMember(t.id, uid); }

  // ── Dashboard ────────────────────────────────────────────────────────────
  @Get('current/dashboard') @UseGuards(JwtAuthGuard, TenantGuard) getDashboard(@CurrentTenant() t: TenantContext) { return this.tenantService.getDashboard(t.id); }
}
