/**
 * LiriPublicController — API publique LIRI v1
 *
 * BASE : /v1/liri
 * Auth: X-Liri-Api-Key header (ApiKeyGuard)
 *
 * Routes :
 *   Sessions
 *     GET    /v1/liri/sessions
 *     POST   /v1/liri/sessions
 *     GET    /v1/liri/sessions/:id
 *     PATCH  /v1/liri/sessions/:id
 *     DELETE /v1/liri/sessions/:id
 *     POST   /v1/liri/sessions/:id/start
 *     POST   /v1/liri/sessions/:id/end
 *     POST   /v1/liri/sessions/:id/embed-token
 *     GET    /v1/liri/sessions/:id/participants
 *     GET    /v1/liri/sessions/:id/waiting-room
 *     POST   /v1/liri/sessions/:id/waiting-room/:wid/admit
 *     POST   /v1/liri/sessions/:id/waiting-room/:wid/reject
 *     GET    /v1/liri/sessions/:id/recordings
 *
 *   API Keys (nécessite aussi TenantGuard pour les mutations)
 *     GET    /v1/liri/api-keys
 *     POST   /v1/liri/api-keys
 *     DELETE /v1/liri/api-keys/:id
 *
 *   Webhooks
 *     GET    /v1/liri/webhooks
 *     POST   /v1/liri/webhooks
 *     DELETE /v1/liri/webhooks/:id
 *     PATCH  /v1/liri/webhooks/:id/toggle
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { LiriPublicService } from './liri-public.service';
import { WebhookService } from './webhook.service';
import { TranscriptionService } from './transcription.service';
import { MultilangService } from '../multilang/multilang.service';
import { NeuroRecallService } from '../neuro-recall/neuro-recall.service';
import { MasterclassFactoryService } from '../masterclass-factory/masterclass-factory.service';
import type { LiveEmbedRole } from '../live/embed/live-embed.types';

type ApiRequest = {
  tenant: { id: string; slug: string; name: string };
  tenantApiKeyId: string;
};

@Controller('v1/liri')
@UseGuards(ApiKeyGuard)
export class LiriPublicController {
  constructor(
    private readonly svc: LiriPublicService,
    private readonly webhooks: WebhookService,
    private readonly transcription: TranscriptionService,
    private readonly multilang: MultilangService,
    private readonly neuroRecall: NeuroRecallService,
    private readonly masterclass: MasterclassFactoryService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // SESSIONS
  // ══════════════════════════════════════════════════════════════════════════

  @Get('sessions')
  async listSessions(
    @Req() req: ApiRequest,
    @Query('status') status?: string,
    @Query('type') session_type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listSessions(req.tenant.id, {
      status,
      session_type: session_type as any,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Post('sessions')
  async createSession(@Req() req: ApiRequest, @Body() body: {
    title: string;
    description?: string;
    session_type?: string;
    scheduled_at?: string;
    capacity?: number;
    price_cents?: number;
    currency?: string;
    replay_enabled?: boolean;
    config?: Record<string, unknown>;
  }) {
    return this.svc.createSession(req.tenant.id, body as any);
  }

  @Get('sessions/:id')
  async getSession(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.getSession(req.tenant.id, id);
  }

  @Patch('sessions/:id')
  async updateSession(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.svc.updateSession(req.tenant.id, id, body);
  }

  @Delete('sessions/:id')
  async deleteSession(@Req() req: ApiRequest, @Param('id') id: string) {
    await this.svc.deleteSession(req.tenant.id, id);
    return { success: true };
  }

  @Post('sessions/:id/start')
  async startSession(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.startSession(req.tenant.id, id);
  }

  @Post('sessions/:id/end')
  async endSession(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.endSession(req.tenant.id, id);
  }

  @Post('sessions/:id/embed-token')
  async getEmbedToken(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: {
      role?: LiveEmbedRole;
      display_name?: string;
    },
  ) {
    return this.svc.generateEmbedToken(
      req.tenant.id,
      req.tenant.slug,
      id,
      body.role ?? 'viewer',
      body.display_name,
    );
  }

  @Get('sessions/:id/participants')
  async getParticipants(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.listParticipants(req.tenant.id, id, req.tenant.slug);
  }

  @Get('sessions/:id/recordings')
  async getRecordings(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.listRecordings(req.tenant.id, id);
  }

  @Get('sessions/:id/waiting-room')
  async getWaitingRoom(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.svc.getWaitingRoom(req.tenant.id, id);
  }

  @Post('sessions/:id/waiting-room/:wid/admit')
  async admitParticipant(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Param('wid') wid: string,
  ) {
    return this.svc.admitFromWaitingRoom(req.tenant.id, id, wid);
  }

  @Post('sessions/:id/waiting-room/:wid/reject')
  async rejectParticipant(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Param('wid') wid: string,
  ) {
    return this.svc.rejectFromWaitingRoom(req.tenant.id, id, wid);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RECORDINGS (global)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('recordings')
  async getAllRecordings(@Req() req: ApiRequest) {
    return this.svc.listRecordings(req.tenant.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // API KEYS (gestion)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('api-keys')
  async listApiKeys(@Req() req: ApiRequest) {
    return this.svc.listApiKeys(req.tenant.id);
  }

  @Post('api-keys')
  async createApiKey(
    @Req() req: ApiRequest,
    @Body() body: { label: string },
  ) {
    const result = await this.svc.createApiKey(req.tenant.id, body.label);
    return {
      ...result,
      _warning: 'Copiez cette clé maintenant — elle ne sera plus affichée.',
    };
  }

  @Delete('api-keys/:id')
  async revokeApiKey(@Req() req: ApiRequest, @Param('id') id: string) {
    await this.svc.revokeApiKey(req.tenant.id, id);
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ══════════════════════════════════════════════════════════════════════════

  @Get('webhooks')
  async listWebhooks(@Req() req: ApiRequest) {
    return this.webhooks.listWebhooks(req.tenant.id);
  }

  @Post('webhooks')
  async createWebhook(
    @Req() req: ApiRequest,
    @Body() body: { label: string; url: string; events: string[]; secret?: string },
  ) {
    return this.webhooks.createWebhook(req.tenant.id, body);
  }

  @Delete('webhooks/:id')
  async deleteWebhook(@Req() req: ApiRequest, @Param('id') id: string) {
    await this.webhooks.deleteWebhook(req.tenant.id, id);
    return { success: true };
  }

  @Patch('webhooks/:id/toggle')
  async toggleWebhook(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: { is_active: boolean },
  ) {
    return this.webhooks.toggleWebhook(req.tenant.id, id, body.is_active);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IA — Transcription / Traduction / Résumé / Neuro Recall
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /v1/liri/sessions/:id/transcribe
   * Transcrit l'enregistrement de la session (Whisper API).
   * Body: { language?: 'fr'|'en'|...; force?: boolean }
   */
  @Post('sessions/:id/transcribe')
  async transcribe(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: { language?: string; force?: boolean },
  ) {
    return this.transcription.transcribeSession(req.tenant.id, id, body);
  }

  /**
   * POST /v1/liri/sessions/:id/summary
   * Génère un résumé IA depuis le transcript (DeepSeek).
   * Body: { length?: 'short'|'medium'|'long'; format?: 'paragraph'|'bullets' }
   */
  @Post('sessions/:id/summary')
  async summarize(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: { length?: 'short' | 'medium' | 'long'; format?: 'paragraph' | 'bullets' },
  ) {
    return this.transcription.summarizeSession(req.tenant.id, id, body);
  }

  /**
   * POST /v1/liri/sessions/:id/translate
   * Traduit le transcript de la session vers N langues.
   * Body: { target_langs: ['en','ar','es']; mode?: 'live'|'video' }
   */
  @Post('sessions/:id/translate')
  async translate(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: { target_langs: string[]; mode?: 'live' | 'video' },
  ) {
    // Récupérer le transcript courant
    const session = await this.svc.getSession(req.tenant.id, id);
    const transcript = (session as any).transcript;
    if (!transcript) {
      return {
        error: 'NOT_TRANSCRIBED',
        message: 'Lancez /transcribe avant /translate.',
      };
    }
    const targetLangs = body.target_langs?.length ? body.target_langs : ['en'];
    const translations =
      body.mode === 'video'
        ? await this.multilang.multilangVideo(transcript, targetLangs, (session as any).title)
        : await this.multilang.multilangLive(transcript, targetLangs);
    return { session_id: id, source_language: 'fr', translations };
  }

  /**
   * POST /v1/liri/sessions/:id/neuro-recall-deck
   * Génère un deck de cartes Q/R depuis le transcript et le sauvegarde dans Neuro Recall.
   * Body: { count?: number (1-50); difficulty?: 'easy'|'medium'|'hard'; save?: boolean; user_id?: string }
   */
  @Post('sessions/:id/neuro-recall-deck')
  async generateRecallDeck(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: {
      count?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      save?: boolean;
      user_id?: string;
    },
  ) {
    const generated = await this.transcription.generateRecallCards(req.tenant.id, id, {
      count: body.count,
      difficulty: body.difficulty,
    });

    if (body.save === false || !generated.cards.length) {
      return { ...generated, saved: false };
    }

    // Sauvegarder le deck dans Neuro Recall (owner = tenant owner si user_id absent)
    const session = await this.svc.getSession(req.tenant.id, id);
    const userId = body.user_id ?? (session as any).host_user_id;

    const deck = await this.neuroRecall.createDeck(
      req.tenant.id,
      userId,
      `${generated.session_title} — Révision`,
      generated.cards,
    );

    return {
      ...generated,
      saved: true,
      deck,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MASTERCLASS FACTORY (LIRI addon — génération masterclass IA)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /v1/liri/masterclasses
   * Génère une masterclass complète depuis un texte source (DeepSeek IA + fallback heuristique).
   * Body: { title: string, source_text: string, user_id?: string }
   */
  @Post('masterclasses')
  async generateMasterclass(
    @Req() req: ApiRequest,
    @Body() body: { title: string; source_text: string; user_id?: string },
  ) {
    if (!body.source_text?.trim()) {
      throw new (await import('@nestjs/common')).BadRequestException('source_text requis');
    }
    const userId = body.user_id ?? '00000000-0000-0000-0000-000000000000';
    return this.masterclass.generateFromText(req.tenant.id, userId, body.title, body.source_text);
  }

  @Get('masterclasses')
  async listMasterclasses(@Req() req: ApiRequest) {
    return this.masterclass.listMasterclasses(req.tenant.id);
  }

  @Get('masterclasses/:id')
  async getMasterclass(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.masterclass.getMasterclass(req.tenant.id, id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TENANT INFO
  // ══════════════════════════════════════════════════════════════════════════

  @Get('me')
  async getMe(@Req() req: ApiRequest) {
    return { tenant: req.tenant, api_key_id: req.tenantApiKeyId };
  }
}
