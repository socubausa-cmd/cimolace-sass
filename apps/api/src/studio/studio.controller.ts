import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { StudioService } from './studio.service';

@ApiTags('Studio')
@ApiBearerAuth()
@Controller('studio')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
export class StudioController {
  constructor(private readonly svc: StudioService) {}

  // ── Hub ─────────────────────────────────────────────────────────────────

  @Get('hub/stats')
  getHubStats(@CurrentTenant() t: TenantContext) {
    return this.svc.getHubStats(t.id);
  }

  // ── Workspaces ──────────────────────────────────────────────────────────

  @Get('workspaces')
  listWorkspaces(@CurrentTenant() t: TenantContext) {
    return this.svc.listWorkspaces(t.id);
  }

  @Get('workspaces/:id')
  getWorkspace(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getWorkspace(t.id, id);
  }

  @Post('workspaces')
  createWorkspace(
    @Body()
    d: { title: string; sourceText?: string; pedagogicalModel?: string },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.createWorkspace(t.id, (r as any).user.id, d);
  }

  @Patch('workspaces/:id')
  updateWorkspace(
    @Param('id') id: string,
    @Body() patch: Record<string, any>,
    @CurrentTenant() t: TenantContext,
  ) {
    return this.svc.updateWorkspace(t.id, id, patch);
  }

  @Post('workspaces/:id/versions')
  saveVersion(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.saveVersion(t.id, id);
  }

  @Post('workspaces/:id/versions/:version/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentTenant() t: TenantContext,
  ) {
    return this.svc.restoreVersion(t.id, id, Number(version));
  }

  @Delete('workspaces/:id')
  deleteWorkspace(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteWorkspace(t.id, id);
  }

  // ── Assets ──────────────────────────────────────────────────────────────

  @Get('assets')
  listAssets(
    @Query('type') type?: string,
    @Query('tags') tags?: string,
    @CurrentTenant() t?: TenantContext,
  ) {
    return this.svc.listAssets(t!.id, type, tags?.split(',').filter(Boolean));
  }

  @Post('assets')
  createAsset(
    @Body()
    d: {
      assetType: string;
      title: string;
      publicUrl?: string;
      tags?: string[];
      width?: number;
      height?: number;
      isTemplate?: boolean;
    },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.createAsset(t.id, (r as any).user.id, d);
  }

  @Delete('assets/:id')
  deleteAsset(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteAsset(t.id, id);
  }

  // ── Formations ──────────────────────────────────────────────────────────

  @Get('formations')
  listFormations(@CurrentTenant() t: TenantContext) {
    return this.svc.listFormations(t.id);
  }

  @Get('formations/:id')
  getFormation(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getFormation(t.id, id);
  }

  @Post('formations')
  createFormation(
    @Body()
    d: { title: string; programmeType?: string; audienceLevel?: string },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.createFormation(t.id, (r as any).user.id, d);
  }

  @Patch('formations/:id/tree')
  updateFormationTree(
    @Param('id') id: string,
    @Body() tree: any,
    @CurrentTenant() t: TenantContext,
  ) {
    return this.svc.updateFormationTree(t.id, id, tree);
  }

  // ── Render Jobs ─────────────────────────────────────────────────────────

  @Get('render-jobs')
  listRenderJobs(@CurrentTenant() t: TenantContext) {
    return this.svc.listRenderJobs(t.id);
  }

  @Get('render-jobs/:id')
  getRenderJob(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getRenderJob(t.id, id);
  }

  @Post('render-jobs')
  enqueueRenderJob(
    @Body()
    d: {
      workspaceId?: string;
      projectId?: string;
      jobType: string;
      exportFormat?: string;
    },
    @CurrentTenant() t: TenantContext,
  ) {
    return this.svc.enqueueRenderJob(t.id, d);
  }
}
