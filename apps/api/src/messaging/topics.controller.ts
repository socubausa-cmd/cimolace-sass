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
  GetOrCreateContextTopicDto,
  ListTopicsQueryDto,
  PublishLiveTopicDto,
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

  /**
   * Phase C — get-or-create idempotent du Sujet d'un contexte (vidéo de cours).
   * Appelé par le panneau Questions du lecteur à sa 1re ouverture. Le contrôle
   * d'accès « inscrit au cours OU encadrant » est fait côté service AVANT toute
   * écriture (403 si refus, aucune création).
   */
  @Post('for-context')
  forContext(
    @Body() dto: GetOrCreateContextTopicDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.getOrCreateContextTopic(t, (req as any).user.id, dto);
  }

  /**
   * Phase D — consolidation POST-LIVE : copie le chat éphémère de la session live
   * dans son Sujet durable. Réservé aux encadrants (403 sinon). Idempotent (la
   * sentinelle de subject empêche toute duplication sur double appel).
   * Déclenché à la fin du live (status='ended') depuis le studio hôte.
   */
  @Post('publish-live')
  publishLive(
    @Body() dto: PublishLiveTopicDto,
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
  ) {
    return this.svc.publishLiveTopic(
      t,
      (req as any).user.id,
      dto.liveSessionId,
      dto.subject,
    );
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
