import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CourseBuilderService } from './course-builder.service';

@Controller('course-builder')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin','teacher')
export class CourseBuilderController {
  constructor(private readonly svc: CourseBuilderService) {}
  @Post('pipelines') createPipeline(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createPipeline(t.id, d.name, d.sourceText); }
  @Get('pipelines') listPipelines(@CurrentTenant() t: TenantContext) { return this.svc.listPipelines(t.id); }
  @Post('pipelines/:id/segment') autoSegment(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.autoSegment(t.id, id); }
  @Get('pipelines/:id/segments') listSegments(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.listSegments(t.id, id); }
  @Post('pipelines/:id/render') enqueueRender(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.enqueueRender(t.id, id); }
  @Get('render-jobs') getRenderJobs(@CurrentTenant() t: TenantContext) { return this.svc.getRenderJobs(t.id); }
  @Get('render-jobs/:id') getRenderStatus(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getRenderStatus(t.id, id); }

  // ── Segment AI (« tableau IA » par chapitre) ──
  @Post('segment-ai-generate') generateSegmentAi(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.generateSegmentAi(t.id, ((r as any).user?.id as string) ?? '', d ?? {}); }
  @Get('segment-ai') listSegmentAi(@Query('contentId') contentId: string, @CurrentTenant() t: TenantContext) { return this.svc.listSegmentAi(t.id, contentId); }
  @Post('segment-ai-approve') approveSegmentAi(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.approveSegmentAi(t.id, d ?? {}); }
}
