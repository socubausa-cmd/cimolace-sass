/**
 * SmartResponseController — endpoints REST pour le chatbot IA + KB + secretariat.
 *
 * Routes :
 *   POST   /smart-response/query                  → Q&A IA (public ou auth)
 *   GET    /smart-response/knowledge              → liste KB (auth)
 *   POST   /smart-response/knowledge              → upsert KB (auth)
 *   DELETE /smart-response/knowledge/:id          → delete KB
 *   POST   /smart-response/knowledge/ingest       → ingest texte → multiple entries
 *   GET    /smart-response/threads                → threads secrétariat
 *   GET    /smart-response/threads/:id/messages   → messages d'un thread
 *   POST   /smart-response/secretariat/reply      → réponse manuelle
 *   POST   /smart-response/followup               → planifier une relance
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { SupabaseService } from '../supabase/supabase.service';
import { SmartResponseService } from './smart-response.service';

@Controller('smart-response')
export class SmartResponseController {
  constructor(
    private readonly svc: SmartResponseService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── Q&A public (sans auth — utilisé par le chatbot du site vitrine) ──
  // Résout le tenant via X-Tenant-Slug header
  @Post('query')
  async query(
    @Req() req: Request,
    @Body() body: { message: string; threadId?: string; visitorName?: string; visitorEmail?: string; tenant_slug?: string },
    @Headers('x-tenant-slug') tenantSlug?: string,
  ) {
    const slug = tenantSlug ?? body.tenant_slug;
    if (!slug) {
      return { error: 'X-Tenant-Slug header ou body.tenant_slug requis' };
    }
    const { data: tenant } = await (this.supabase.client as any)
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (!tenant) return { error: 'Tenant introuvable ou inactif' };

    return this.svc.query(tenant.id, body);
  }

  // ── KB management (auth requise) ─────────────────────────────────────

  @Get('knowledge')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async listKB(
    @CurrentTenant() t: TenantContext,
    @Query('active') active?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listKnowledge(t.id, {
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('knowledge')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async upsertKB(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: any,
  ) {
    return this.svc.upsertKnowledge(t.id, (req as any).user?.id ?? null, body);
  }

  @Delete('knowledge/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async deleteKB(@CurrentTenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.deleteKnowledge(t.id, id);
  }

  @Post('knowledge/ingest')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async ingestKB(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { sourceLabel?: string; sourceUrl?: string; rawText: string },
  ) {
    return this.svc.ingestKnowledge(t.id, (req as any).user?.id ?? null, body);
  }

  // ── Threads secrétariat (auth requise) ───────────────────────────────

  @Get('threads')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async listThreads(
    @CurrentTenant() t: TenantContext,
    @Query('status') status?: string,
    @Query('assigned_to') assignedTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listThreads(t.id, {
      status,
      assigned_to: assignedTo,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('threads/:id/messages')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async threadMessages(
    @CurrentTenant() t: TenantContext,
    @Param('id') id: string,
  ) {
    return this.svc.threadMessages(t.id, id);
  }

  @Post('secretariat/reply')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async secretariatReply(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { threadId: string; message: string; status?: string },
  ) {
    return this.svc.secretariatReply(t.id, (req as any).user?.id ?? null, body);
  }

  @Post('followup')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createFollowup(
    @CurrentTenant() t: TenantContext,
    @Body() body: { threadId: string; scheduledAt: string; reason?: string; template?: string; payload?: any },
  ) {
    return this.svc.createFollowup(t.id, body);
  }
}
