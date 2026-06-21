import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import {
  CreateTopicDto,
  ListTopicsQueryDto,
  SendTopicMessageDto,
} from './dto/topics.dto';
import { TopicsService } from './topics.service';

/**
 * Endpoints « Sujets » (forum connecté) — additifs au module messaging.
 * Mêmes gardes que la messagerie : JwtAuthGuard + TenantGuard, scope tenant.
 * L'envoi de message dans un Sujet réutilise le même insert `messages` que les DM
 * (table partagée), exposé ici via POST /messaging/topics/:id/messages.
 */
@Controller('messaging/topics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TopicsController {
  constructor(private readonly svc: TopicsService) {}

  @Get()
  list(
    @Query() q: ListTopicsQueryDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.listTopics(t, (req as any).user.id, q);
  }

  @Post()
  create(
    @Body() dto: CreateTopicDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.createTopic(t, (req as any).user.id, dto);
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.getTopic(t, (req as any).user.id, id);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.getTopicMessages(t, (req as any).user.id, id);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendTopicMessageDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.postMessage(t, (req as any).user.id, id, dto.content);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.closeTopic(t, (req as any).user.id, id);
  }

  @Post(':id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.reopenTopic(t, (req as any).user.id, id);
  }
}
