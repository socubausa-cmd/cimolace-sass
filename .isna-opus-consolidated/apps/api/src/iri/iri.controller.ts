import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { IriService } from './iri.service';

@Controller('iri')
export class IriController {
  constructor(private readonly svc: IriService) {}

  @Get('pages') @UseGuards(JwtAuthGuard, TenantGuard) listPages(@CurrentTenant() t: TenantContext) { return this.svc.listPages(t.id); }
  @Get('pages/:slug') @UseGuards(JwtAuthGuard, TenantGuard) getPage(@Param('slug') slug: string, @CurrentTenant() t: TenantContext) { return this.svc.getPage(t.id, slug); }
  @Post('pages') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') createPage(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createPage(t.id, (r as any).user.id, d); }
  @Patch('pages/:slug') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') updatePage(@Param('slug') slug: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.updatePage(t.id, slug, d); }
  @Post('pages/:slug/publish') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') publishPage(@Param('slug') slug: string, @CurrentTenant() t: TenantContext) { return this.svc.publishPage(t.id, slug); }
  @Delete('pages/:slug') @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin') deletePage(@Param('slug') slug: string, @CurrentTenant() t: TenantContext) { return this.svc.deletePage(t.id, slug); }

  @Get('p/:slug') getPublicPage(@Param('slug') slug: string) { return this.svc.getPublicPage(slug); }
}
