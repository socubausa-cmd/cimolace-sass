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
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { LiriBrainService } from './liri-brain.service';
import { BrainToolsService } from './brain-tools.service';
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
  constructor(
    private readonly liriBrain: LiriBrainService,
    private readonly brainTools: BrainToolsService,
  ) {}

  // ── Models ───────────────────────────────────────────────────────────────

  @Get('models')
  getModels() {
    return this.liriBrain.getModels();
  }

  // ── Tools (registre function-calling, filtré par rôle de l'appelant) ───────

  @Get('tools')
  getTools(@CurrentTenant() tenant: TenantContext) {
    return this.brainTools.getToolSpecs(tenant.userRole);
  }

  /**
   * Exécute un outil APRÈS confirmation utilisateur (pour les actions d'écriture
   * que la boucle a mises en attente via `{type:'tool_confirm'}`). RBAC + tenant
   * sont re-vérifiés dans BrainToolsService.execute().
   */
  @Post('tools/execute')
  executeTool(
    @Body() body: { name: string; args?: Record<string, any> },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = ((req as any).user?.id as string) ?? '';
    return this.brainTools.execute(body?.name, body?.args ?? {}, {
      tenant,
      userId,
      role: tenant.userRole,
    });
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

  /**
   * Sauvegarde (création ou mise à jour) d'une conversation. Appelé par le front
   * à la fin de chaque tour. `messages` = transcript complet ; sans conversationId
   * → création. RBAC : JwtAuthGuard + TenantGuard (niveau contrôleur).
   */
  @Post('conversations')
  saveConversation(
    @Body()
    body: {
      conversationId?: string;
      model?: LiriModel;
      title?: string;
      messages?: LiriMessage[];
    },
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const userId = ((req as any).user?.id as string) ?? '';
    return this.liriBrain.saveConversation(
      tenant.id,
      userId,
      (body?.model ?? 'deepseek-chat') as LiriModel,
      body?.title ?? '',
      Array.isArray(body?.messages) ? body.messages : [],
      body?.conversationId,
    );
  }

  // ── SSE Chat Stream ──────────────────────────────────────────────────────

  // @SkipResponseWrapper : sans ça, le ResponseInterceptor global emballe chaque
  // MessageEvent SSE dans { data: … } → double encapsulation que le front ne sait
  // pas défaire (il fait un seul JSON.parse). On laisse passer le flux brut.
  @Sse('chat')
  @SkipResponseWrapper()
  chat(
    // ⚠️ NE PAS ajouter @Body() ici : @Sse() est un GET sans corps, et le
    // ValidationPipe global rejetterait un body vide contre un DTO (message
    // requis) → 400 avant le handler. Tous les paramètres viennent de la query.
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

    // ?tools=1 → boucle function-calling (lecture auto / écriture = confirmation).
    // streamConversation charge l'historique (conversationId) → mémoire du LLM.
    const generator = this.liriBrain.streamConversation(
      model,
      message,
      {
        tenant,
        userId: ((req as any).user?.id as string) ?? '',
        role: tenant.userRole,
      },
      { conversationId, useTools: req.query.tools === '1' },
    );
    return sseFromGenerator(generator);
  }
}
