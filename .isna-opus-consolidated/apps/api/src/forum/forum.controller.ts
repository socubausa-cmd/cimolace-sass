import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreatePostDto, CreateTopicDto } from './dto/forum.dto';
import { ForumService } from './forum.service';

@Controller('forum')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ForumController {
  constructor(private readonly svc: ForumService) {}

  @Get('categories')
  listCategories(@CurrentTenant() t: TenantContext) { return this.svc.listCategories(t.id); }

  @Get('topics')
  listTopics(@CurrentTenant() t: TenantContext, @Query('category') cat?: string, @Query('page') page?: string) { return this.svc.listTopics(t.id, cat, parseInt(page ?? '1')); }

  @Get('topics/search')
  searchTopics(@CurrentTenant() t: TenantContext, @Query('q') q: string) { return this.svc.searchTopics(t.id, q); }

  @Get('topics/:id')
  getTopic(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getTopic(t.id, id); }

  @Post('topics')
  createTopic(@Body() dto: CreateTopicDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.createTopic(t, (req as any).user.id, dto); }

  @Delete('topics/:id')
  @UseGuards(RolesGuard) @Roles('owner', 'admin')
  deleteTopic(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deleteTopic(t.id, id); }

  @Get('topics/:topicId/posts')
  listPosts(@Param('topicId') topicId: string, @CurrentTenant() t: TenantContext) { return this.svc.listPosts(t.id, topicId); }

  @Post('topics/:topicId/posts')
  createPost(@Param('topicId') topicId: string, @Body() dto: CreatePostDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.createPost(t, topicId, (req as any).user.id, dto); }

  @Delete('posts/:id')
  @UseGuards(RolesGuard) @Roles('owner', 'admin')
  deletePost(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deletePost(t.id, id); }
}
