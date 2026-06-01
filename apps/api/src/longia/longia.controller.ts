import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Post, Req, Sse, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { LongiaService } from './longia.service';

function sseFromGen(
  gen: AsyncGenerator<{ content: string; done: boolean }>,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((sub) => {
    void (async () => {
      try {
        for await (const c of gen) {
          sub.next({ data: JSON.stringify(c) } as MessageEvent);
          if (c.done) break;
        }
      } catch (e) {
        sub.next({
          data: JSON.stringify({ content: 'Erreur: ' + String(e), done: true }),
        } as MessageEvent);
      }
      sub.complete();
    })();
  });
}

@ApiTags('Longia')
@ApiBearerAuth()
@Controller('longia')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LongiaController {
  constructor(private readonly svc: LongiaService) {}

  @Sse('chat')
  chat(
    @Req() req: Request & { query: Record<string, string> },
  ): Observable<MessageEvent> {
    const msg = req.query.message ?? '';
    if (!msg)
      return new Observable<MessageEvent>((sub) => {
        sub.next({
          data: JSON.stringify({ content: 'Message vide.', done: true }),
        } as MessageEvent);
        sub.complete();
      });
    return sseFromGen(this.svc.streamChat([{ role: 'user', content: msg }]));
  }

  @Post('chat')
  async chatSync(@Body() d: any) {
    return {
      reply: await this.svc.chatCompletion(
        d.messages || [{ role: 'user', content: d.message }],
        d.systemPrompt,
      ),
    };
  }

  @Post('admin/document')
  async analyzeDocument(@Body() d: any) {
    return this.svc.analyzeDocument(d.content, d.instruction);
  }

  @Post('guest/live')
  async guestLive(
    @Body() d: any,
    @CurrentTenant() _t: TenantContext,
    @Req() _r: Request,
  ) {
    return {
      reply: await this.svc.chatCompletion(
        [{ role: 'user', content: d.message || 'Bonjour' }],
        'Tu es un assistant de live interactif. Reponds de maniere concise et engageante.',
      ),
    };
  }

  @Post('live/realtime')
  async liveRealtime(@Body() d: any, @CurrentTenant() _t: TenantContext) {
    return {
      reply: await this.svc.chatCompletion(
        [{ role: 'user', content: d.transcript || d.message || '' }],
        'Tu es un co-pilote de live. Analyse ce qui se dit et suggere une reponse ou action.',
      ),
    };
  }

  @Post('cover/prompt')
  async coverPrompt(@Body() d: any) {
    return this.svc.coverPromptAssistant(d.brief, d.style);
  }
}
