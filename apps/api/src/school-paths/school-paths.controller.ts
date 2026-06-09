import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchoolPathsService } from './school-paths.service';

@Controller('school-paths')
@UseGuards(JwtAuthGuard)
export class SchoolPathsController {
  constructor(private readonly svc: SchoolPathsService) {}

  // ── Paths ─────────────────────────────────────────────────────────────────────

  @Get()
  listPaths(@Req() req: Request) {
    return this.svc.listPaths((req as any).user.id);
  }

  @Post()
  createPath(@Body() dto: Record<string, any>, @Req() req: Request) {
    return this.svc.createPath((req as any).user.id, dto);
  }

  @Get(':pathId')
  getPathTree(@Param('pathId') pathId: string, @Req() req: Request) {
    return this.svc.getPathTree(pathId, (req as any).user.id);
  }

  @Put(':pathId')
  updatePath(@Param('pathId') pathId: string, @Body() dto: Record<string, any>, @Req() req: Request) {
    return this.svc.updatePath(pathId, (req as any).user.id, dto);
  }

  @Delete(':pathId')
  deletePath(@Param('pathId') pathId: string, @Req() req: Request) {
    return this.svc.deletePath(pathId, (req as any).user.id);
  }

  // ── Courses ───────────────────────────────────────────────────────────────────

  @Get(':pathId/courses')
  listCourses(@Param('pathId') pathId: string) {
    return this.svc.listCourses(pathId);
  }

  @Post(':pathId/courses')
  createCourse(@Param('pathId') pathId: string, @Body() dto: Record<string, any>) {
    return this.svc.createCourse(pathId, dto);
  }

  @Put('courses/:courseId')
  updateCourse(@Param('courseId') courseId: string, @Body() dto: Record<string, any>) {
    return this.svc.updateCourse(courseId, dto);
  }

  @Delete('courses/:courseId')
  deleteCourse(@Param('courseId') courseId: string) {
    return this.svc.deleteCourse(courseId);
  }

  // ── Modules ───────────────────────────────────────────────────────────────────

  @Get('courses/:courseId/modules')
  listModules(@Param('courseId') courseId: string) {
    return this.svc.listModules(courseId);
  }

  @Post('courses/:courseId/modules')
  createModule(@Param('courseId') courseId: string, @Body() dto: Record<string, any>) {
    return this.svc.createModule(courseId, dto);
  }

  // ── Weeks ─────────────────────────────────────────────────────────────────────

  @Get('modules/:moduleId/weeks')
  listWeeks(@Param('moduleId') moduleId: string) {
    return this.svc.listWeeks(moduleId);
  }

  @Post('modules/:moduleId/weeks')
  createWeek(@Param('moduleId') moduleId: string, @Body() dto: Record<string, any>) {
    return this.svc.createWeek(moduleId, dto);
  }

  @Put('weeks/:weekId')
  updateWeek(@Param('weekId') weekId: string, @Body() dto: Record<string, any>) {
    return this.svc.updateWeek(weekId, dto);
  }

  @Delete('weeks/:weekId')
  deleteWeek(@Param('weekId') weekId: string) {
    return this.svc.deleteWeek(weekId);
  }

  // ── Days ──────────────────────────────────────────────────────────────────────

  @Get('weeks/:weekId/days')
  listDays(@Param('weekId') weekId: string) {
    return this.svc.listDays(weekId);
  }

  @Post('weeks/:weekId/days')
  createDay(@Param('weekId') weekId: string, @Body() dto: Record<string, any>) {
    return this.svc.createDay(weekId, dto);
  }

  @Put('days/:dayId')
  updateDay(@Param('dayId') dayId: string, @Body() dto: Record<string, any>) {
    return this.svc.updateDay(dayId, dto);
  }

  @Delete('days/:dayId')
  deleteDay(@Param('dayId') dayId: string) {
    return this.svc.deleteDay(dayId);
  }

  // ── Blocks ────────────────────────────────────────────────────────────────────

  @Get('days/:dayId/blocks')
  listBlocks(@Param('dayId') dayId: string) {
    return this.svc.listBlocks(dayId);
  }

  @Post('days/:dayId/blocks')
  createBlock(@Param('dayId') dayId: string, @Body() dto: Record<string, any>) {
    return this.svc.createBlock(dayId, dto);
  }

  @Put('blocks/:blockId')
  updateBlock(@Param('blockId') blockId: string, @Body() dto: Record<string, any>) {
    return this.svc.updateBlock(blockId, dto);
  }

  @Delete('blocks/:blockId')
  deleteBlock(@Param('blockId') blockId: string) {
    return this.svc.deleteBlock(blockId);
  }

  // ── Grammar ───────────────────────────────────────────────────────────────────

  @Post('weeks/:weekId/apply-grammar')
  applyGrammar(@Param('weekId') weekId: string, @Body('grammarKey') grammarKey: string) {
    return this.svc.applyGrammar(weekId, grammarKey);
  }
}
