import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import {
  AnalyzeDocumentDto,
  EnqueueOrchestratorDto,
  GenerateMasterclassDto,
} from './dto/generate-masterclass.dto';
import { MasterclassFactoryService } from './masterclass-factory.service';

@Controller('masterclass-factory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
export class MasterclassFactoryController {
  constructor(private readonly svc: MasterclassFactoryService) {}

  // ── Projects CRUD ──────────────────────────────────────────────────────

  @Get('projects')
  listProjects(@CurrentTenant() t: TenantContext) {
    return this.svc.listProjects(t.id);
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getProject(t.id, id);
  }

  @Post('projects')
  createProject(
    @Body() d: { title: string; sourceText?: string; pedagogicalModel?: string },
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.createProject(t.id, (r as any).user.id, d);
  }

  @Delete('projects/:id')
  deleteProject(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteProject(t.id, id);
  }

  // ── AI Operations ──────────────────────────────────────────────────────

  @Post('analyze')
  analyzeDocument(@Body() d: AnalyzeDocumentDto, @CurrentTenant() t: TenantContext): Promise<any> {
    return this.svc.analyzeDocument(t.id, d);
  }

  @Post('generate')
  generateMasterclass(
    @Body() d: GenerateMasterclassDto,
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ): Promise<any> {
    return this.svc.generateMasterclass(t.id, (r as any).user.id, d);
  }

  @Post('orchestrate')
  enqueueOrchestrator(
    @Body() d: EnqueueOrchestratorDto,
    @CurrentTenant() t: TenantContext,
    @Req() r: Request,
  ) {
    return this.svc.enqueueOrchestrator(t.id, (r as any).user.id, d);
  }
}
