import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateGroupDto, EditMessageDto, SendMessageDto } from './dto/messaging.dto';
import { ListForumTopicsQueryDto } from './dto/topics.dto';
import { MessagingService } from './messaging.service';
import { TopicsService } from './topics.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagingController {
  constructor(
    private readonly svc: MessagingService,
    private readonly topics: TopicsService,
  ) {}

  /**
   * LOT 1 — lecture FORUM des Sujets publics du tenant (kind='topic', visibility=
   * 'public'), triés par updated_at desc, avec message_count. Sert le forum
   * (StudentForumRedesign) côté API : les messages étant lus en service_role, le
   * front passe par ici plutôt que par PostgREST direct. Mêmes gardes que le reste
   * du module (JwtAuthGuard + TenantGuard), scope tenant.
   */
  @Get('forum-topics')
  listForumTopics(@Query() q: ListForumTopicsQueryDto, @CurrentTenant() t: TenantContext) {
    return this.topics.listForumTopics(t, { limit: q.limit });
  }

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.sendMessage(t, (req as any).user.id, dto); }

  @Get('conversations')
  listConversations(@CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.listConversations(t.id, (req as any).user.id); }

  @Get('conversations/:id')
  getMessages(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.getMessages(t.id, id, (req as any).user.id); }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.createGroup(t, (req as any).user.id, dto); }

  @Post('groups/:id/members')
  addMember(@Param('id') id: string, @Body('userId') uid: string, @CurrentTenant() t: TenantContext) { return this.svc.addGroupMember(t.id, id, uid); }

  @Patch('messages/:id')
  editMessage(@Param('id') id: string, @Body() dto: EditMessageDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.editMessage(t.id, (req as any).user.id, id, dto.content); }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.deleteMessage(t.id, (req as any).user.id, id); }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.markConversationRead(t.id, (req as any).user.id, id); }
}
