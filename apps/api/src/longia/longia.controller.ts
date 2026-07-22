import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Post, Req, Sse, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { AllowNonMember } from '../common/decorators/allow-non-member.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { LongiaService } from './longia.service';
import { UsageService } from '../usage/usage.service';

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

// @AllowNonMember : assistant IA de live (dont /guest/live) — n'utilise aucune
// donnée tenant scopée (pur passthrough IA) ; on préserve l'accès invité.
@ApiTags('Longia')
@ApiBearerAuth()
@Controller('longia')
@UseGuards(JwtAuthGuard, TenantGuard)
@AllowNonMember()
export class LongiaController {
  constructor(
    private readonly svc: LongiaService,
    private readonly usage: UsageService,
  ) {}

  /** Garde crédits IA : 1 requête = 1 crédit ; tenant résolu par TenantGuard. */
  private gate(req: any, source: string) {
    const tid = req?.tenant?.id;
    return tid ? this.usage.assertAiCredit(tid, source) : Promise.resolve();
  }

  @Sse('chat')
  async chat(
    @Req() req: Request & { query: Record<string, string> },
  ): Promise<Observable<MessageEvent>> {
    await this.gate(req, 'ai:longia:chat');
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
  async chatSync(@Body() d: any, @Req() req: Request) {
    await this.gate(req, 'ai:longia:chat');
    return {
      reply: await this.svc.chatCompletion(
        d.messages || [{ role: 'user', content: d.message }],
        d.systemPrompt,
      ),
    };
  }

  @Post('admin/document')
  async analyzeDocument(@Body() d: any, @Req() req: Request) {
    await this.gate(req, 'ai:longia:document');
    return this.svc.analyzeDocument(d.content, d.instruction);
  }

  @Post('guest/live')
  async guestLive(
    @Body() d: any,
    @CurrentTenant() t: TenantContext,
    @Req() _r: Request,
  ) {
    await this.usage.assertAiCredit(t.id, 'ai:longia:guest-live');
    return {
      reply: await this.svc.chatCompletion(
        [{ role: 'user', content: d.message || 'Bonjour' }],
        'Tu es un assistant de live interactif. Reponds de maniere concise et engageante.',
      ),
    };
  }

  @Post('live/realtime')
  async liveRealtime(@Body() d: any, @CurrentTenant() t: TenantContext) {
    await this.usage.assertAiCredit(t.id, 'ai:longia:realtime');
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

  // Cerveau social : légende + hashtags pour un short de live (suggestion manuelle
  // côté front ; réutilisable par le pipeline auto shorts→réseaux).
  @Post('short-caption')
  async shortCaption(@Body() d: any) {
    return this.svc.shortCaption(
      d.transcript || d.transcriptSnippet || '',
      d.platform || 'tiktok',
      d.tone || 'dynamique',
      d.title,
    );
  }
}
