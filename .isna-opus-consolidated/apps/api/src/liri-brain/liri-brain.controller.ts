import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { ChatDto } from './dto/chat.dto';
import { LiriBrainService } from './liri-brain.service';
import type { LiriMessage, LiriModel } from './liri-brain.types';

/**
 * SSE helper: wraps an AsyncGenerator into an RxJS Observable
 * that emits MessageEvent-shaped objects.
 */
function sseFromGenerator(
  generator: AsyncGenerator<{ content: string; done: boolean }>,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    void (async () => {
      try {
        for await (const chunk of generator) {
          subscriber.next({
            data: JSON.stringify(chunk),
          } as MessageEvent);
          if (chunk.done) break;
        }
      } catch (err) {
        subscriber.next({
          data: JSON.stringify({ content: `Erreur: ${String(err)}`, done: true }),
        } as MessageEvent);
      }
      subscriber.complete();
    })();
  });
}

@Controller('liri/brain')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LiriBrainController {
  constructor(private readonly liriBrain: LiriBrainService) {}

  // ── Models ───────────────────────────────────────────────────────────────

  @Get('models')
  getModels() {
    return this.liriBrain.getModels();
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  @Get('conversations')
  listConversations(@CurrentTenant() tenant: TenantContext, @Req() req: Request) {
    const userId = (req as any).user as { id: string };
    return this.liriBrain.listConversations(tenant.id, userId.id);
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.liriBrain.getConversation(tenant.id, id);
  }

  // ── SSE Chat Stream ──────────────────────────────────────────────────────

  @Sse('chat')
  chat(
    @Body() _dto: ChatDto,
    @Req() req: Request & { query: Record<string, string> },
    @CurrentTenant() tenant: TenantContext,
  ): Observable<MessageEvent> {
    // SSE doesn't support request body natively → read from query params
    const message = req.query.message ?? '';
    const model = (req.query.model as LiriModel) ?? 'deepseek-chat';
    const conversationId = req.query.conversationId;

    if (!message) {
      return new Observable<MessageEvent>((sub) => {
        sub.next({ data: JSON.stringify({ content: 'Message vide.', done: true }) } as MessageEvent);
        sub.complete();
      });
    }

    const messages: LiriMessage[] = [
      { role: 'user', content: message },
    ];

    const generator = this.liriBrain.streamChat(model, messages, tenant);
    return sseFromGenerator(generator);
  }

  // ── Bloc Edge IA ────────────────────────────────────────────────────────

  @Post('smartboard/chat')
  async smartboardDesignerChat(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) {
    return this.liriBrain.smartboardDesignerChat(t.id, (r as any).user.id, d.messages, d.context);
  }

  @Post('generate-quiz')
  async generateQuiz(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.liriBrain.generateQuiz(t.id, d.content, d.questionCount || 5);
  }

  @Post('generate-mindmap')
  async generateMindmap(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.liriBrain.generateMindmap(t.id, d.content);
  }

  @Post('generate-transcript')
  async generateTranscript(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.liriBrain.generateTranscript(t.id, d.content);
  }

  @Post('translate')
  async translate(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.liriBrain.translate(t.id, d.content, d.targetLang || 'en');
  }

  @Post('text-to-speech')
  async textToSpeech(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.liriBrain.textToSpeech(t.id, d.text, d.voice || 'alloy');
  }
}
