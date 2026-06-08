import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { KnowledgeService } from './knowledge.service';

/**
 * Base de connaissances RAG (gte-small + pgvector). Toutes les routes : JWT + Tenant.
 *   POST   /knowledge          → ingérer (embed + upsert) une entrée
 *   GET    /knowledge          → lister les entrées du tenant
 *   DELETE /knowledge/:id      → supprimer
 *   POST   /knowledge/search   → recherche sémantique (extraits + similarité)
 *   POST   /knowledge/answer   → réponse RAG citée (recherche + LLM)
 */
@Controller('knowledge')
@UseGuards(JwtAuthGuard, TenantGuard)
export class KnowledgeController {
  constructor(private readonly svc: KnowledgeService) {}

  @Post()
  ingest(
    @CurrentTenant() t: TenantContext,
    @Body() body: { title?: string; topic?: string; content?: string; source?: string; id?: string },
  ) {
    return this.svc.ingest(t, body ?? {});
  }

  @Get()
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.remove(t.id, id);
  }

  @Post('search')
  search(
    @CurrentTenant() t: TenantContext,
    @Body() body: { query?: string; matchCount?: number; threshold?: number },
  ) {
    return this.svc.search(t.id, body?.query ?? '', {
      matchCount: body?.matchCount,
      threshold: body?.threshold,
    });
  }

  @Post('answer')
  answer(@CurrentTenant() t: TenantContext, @Body() body: { question?: string; matchCount?: number }) {
    return this.svc.answer(t.id, body?.question ?? '', { matchCount: body?.matchCount });
  }
}
