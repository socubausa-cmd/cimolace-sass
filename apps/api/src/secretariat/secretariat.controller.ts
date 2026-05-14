import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { AssignTeacherDto, CreateDocumentDto, ProcessEnrollmentDto, UpdateWorkflowStepDto } from './dto/secretariat.dto';
import { SecretariatService } from './secretariat.service';

@Controller('secretariat')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'secretariat')
export class SecretariatController {
  constructor(private readonly svc: SecretariatService) {}

  @Get('enrollments')
  listEnrollments(@CurrentTenant() t: TenantContext, @Query('status') status?: string) { return this.svc.listEnrollments(t.id, status); }

  @Patch('enrollments/:id')
  processEnrollment(@Param('id') id: string, @Body() dto: ProcessEnrollmentDto, @CurrentTenant() t: TenantContext, @Req() req: Request) {
    return this.svc.processEnrollment(t.id, id, (req as any).user.id, dto);
  }

  @Post('assign-teacher')
  assignTeacher(@Body() dto: AssignTeacherDto, @CurrentTenant() t: TenantContext) { return this.svc.assignTeacher(t.id, dto); }

  @Get('assignments')
  listAssignments(@CurrentTenant() t: TenantContext) { return this.svc.listTeacherAssignments(t.id); }

  @Post('documents')
  createDocument(@Body() dto: CreateDocumentDto, @CurrentTenant() t: TenantContext, @Req() req: Request) {
    return this.svc.createDocument(t.id, (req as any).user.id, dto);
  }

  @Get('documents')
  listDocuments(@CurrentTenant() t: TenantContext) { return this.svc.listDocuments(t.id); }

  @Get('workflow')
  listWorkflow(@CurrentTenant() t: TenantContext, @Query('entityType') et?: string, @Query('entityId') eid?: string) { return this.svc.listWorkflowSteps(t.id, et, eid); }

  @Patch('workflow/:id')
  updateWorkflow(@Param('id') id: string, @Body() dto: UpdateWorkflowStepDto, @CurrentTenant() t: TenantContext, @Req() req: Request) {
    return this.svc.updateWorkflowStep(t.id, id, (req as any).user.id, dto);
  }
}
