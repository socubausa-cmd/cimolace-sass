import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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
  @Get('pipelines/:id') getPipeline(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getPipeline(t.id, id); }
  @Delete('pipelines/:id') deletePipeline(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deletePipeline(t.id, id); }

  // Segmentation
  @Post('pipelines/:id/segment') autoSegment(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.autoSegment(t.id, id); }
  @Get('pipelines/:id/segments') listSegments(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.listSegments(t.id, id); }

  // Master Script
  @Post('pipelines/:id/master-script') generateMasterScript(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.generateMasterScript(t.id, id); }

  // Segment AI
  @Post('segments/:id/generate') generateSegment(@Param('id') sid: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.generateSegmentContent(t.id, d.pipelineId, sid); }
  @Post('segments/:id/approve') approveSegment(@Param('id') sid: string, @CurrentTenant() t: TenantContext) { return this.svc.approveSegment(t.id, sid); }
  @Post('segments/:id/regenerate') regenerateSegment(@Param('id') sid: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.regenerateSegment(t.id, d.pipelineId, sid, d.feedback); }

  // Render
  @Post('pipelines/:id/render') enqueueRender(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.enqueueRender(t.id, id); }
  @Get('render-jobs') getRenderJobs(@CurrentTenant() t: TenantContext) { return this.svc.getRenderJobs(t.id); }
  @Get('render-jobs/:id') getRenderStatus(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getRenderStatus(t.id, id); }

  // Post-prod
  @Get('pipelines/:id/versions') listVersions(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.listPostProdVersions(t.id, id); }
  @Post('pipelines/:id/versions') saveVersion(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.savePostProdVersion(t.id, id, d.label); }
  @Post('pipelines/:id/versions/:vid/restore') restoreVersion(@Param('id') id: string, @Param('vid') vid: string, @CurrentTenant() t: TenantContext) { return this.svc.restorePostProdVersion(t.id, id, vid); }
}
