import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CoursesService } from './courses.service';
import { CreateCourseDto, CreateLessonDto, CreateModuleDto, UpdateProgressDto } from './dto/courses.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CoursesController {
  constructor(private readonly svc: CoursesService) {}

  @Post() @UseGuards(RolesGuard) @Roles('owner','admin','teacher')
  createCourse(@Body() d: CreateCourseDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createCourse(t, (r as any).user.id, d); }
  @Get() listCourses(@CurrentTenant() t: TenantContext) { return this.svc.listCourses(t.id); }
  @Get(':id') getCourse(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getCourse(t.id, id); }
  @Patch(':id') @UseGuards(RolesGuard) @Roles('owner','admin','teacher')
  updateCourse(@Param('id') id: string, @Body() d: Record<string, unknown>, @CurrentTenant() t: TenantContext) { return this.svc.updateCourse(t.id, id, d); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('owner','admin','teacher')
  deleteCourse(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deleteCourse(t.id, id); }

  @Post(':courseId/modules') @UseGuards(RolesGuard) @Roles('owner','admin','teacher')
  createModule(@Param('courseId') cid: string, @Body() d: CreateModuleDto, @CurrentTenant() t: TenantContext) { return this.svc.createModule(t, cid, d); }
  @Get(':courseId/modules') listModules(@Param('courseId') cid: string, @CurrentTenant() t: TenantContext) { return this.svc.listModules(t.id, cid); }

  @Post('modules/:moduleId/lessons') @UseGuards(RolesGuard) @Roles('owner','admin','teacher')
  createLesson(@Param('moduleId') mid: string, @Body() d: CreateLessonDto, @CurrentTenant() t: TenantContext) { return this.svc.createLesson(t, mid, d); }
  @Get('modules/:moduleId/lessons') listLessons(@Param('moduleId') mid: string, @CurrentTenant() t: TenantContext) { return this.svc.listLessons(t.id, mid); }

  @Patch('progress/:lessonId') updateProgress(@Param('lessonId') lid: string, @Body() d: UpdateProgressDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.updateProgress(t.id, (r as any).user.id, lid, d); }
  @Get(':courseId/progress') getProgress(@Param('courseId') cid: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getProgress(t.id, (r as any).user.id, cid); }

  // Signature CÔTÉ SERVEUR d'une vidéo de cours hébergée, gatée par palier/inscription (anti-lien-partagé).
  @Post(':courseId/video-url')
  signVideoUrl(@Param('courseId') cid: string, @Body() d: { contentId: string }, @CurrentTenant() t: TenantContext, @Req() r: Request) {
    return this.svc.signCourseVideoUrl(t, (r as any).user.id, cid, d?.contentId);
  }
}
