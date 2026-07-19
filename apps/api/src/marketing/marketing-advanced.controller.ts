/**
 * MarketingAdvancedController — Port des ~20 lambdas v1 (marketing-*).
 *
 * Routes (tenant-scoped sauf indication PUBLIC) :
 *   GET    /marketing/analytics                 → KPIs (campagnes, leads, revenue)
 *   GET    /marketing/logs                      → marketing_logs (paginé)
 *   POST   /marketing/publish                   → publish campagne (multi-canal)
 *   POST   /marketing/orchestrate               → orchestration scénarios lead
 *   POST   /marketing/payment-recovery          → relance paiements échoués
 *   POST   /marketing/score-refresh             → recompute lead scores
 *   POST   /marketing/ai-suggest-message        → suggestions IA (templates)
 *
 *   GET    /marketing/campaigns                 → liste paginée
 *   POST   /marketing/campaigns                 → create
 *   POST   /marketing/campaigns/action          → start/pause/duplicate/archive/complete
 *
 *   GET    /marketing/funnels                   → liste + perf
 *   POST   /marketing/funnels                   → create + steps
 *
 *   GET    /marketing/automations               → liste flows + actions
 *   POST   /marketing/automations               → create flow
 *   PATCH  /marketing/automations               → update flow
 *   POST   /marketing/automations/delete        → delete flow
 *   POST   /marketing/automations/run           → exec flows par trigger
 *   GET    /marketing/automations/audit         → audit logs
 *   POST   /marketing/automations/audit         → record audit
 *
 *   GET    /marketing/leads                     → liste paginée
 *   POST   /marketing/leads/capture             → PUBLIC : capture lead
 */

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { TenantService } from '../tenant/tenant.service';
import { MarketingAdvancedService } from './marketing-advanced.service';

@Controller('marketing')
export class MarketingAdvancedController {
  constructor(
    private readonly svc: MarketingAdvancedService,
    private readonly tenants: TenantService,
  ) {}

  // ─── Analytics / Logs / Publish / Orchestrate ────────────────────────────

  @Get('analytics')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  analytics(@CurrentTenant() t: TenantContext) {
    return this.svc.getAnalytics(t.id);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  logs(
    @CurrentTenant() t: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action_prefix') prefix?: string,
  ) {
    return this.svc.listLogs(t.id, { limit: Number(limit) || 200, offset: Number(offset) || 0, actionPrefix: prefix });
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  publish(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.publish(t.id, body);
  }

  @Post('orchestrate')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  orchestrate(@CurrentTenant() t: TenantContext, @Body() body: { leadId?: string }) {
    return this.svc.orchestrate(t.id, body);
  }

  @Post('payment-recovery')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  paymentRecovery(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.paymentRecovery(t.id, body);
  }

  @Post('score-refresh')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  scoreRefresh(@CurrentTenant() t: TenantContext) {
    return this.svc.scoreRefresh(t.id);
  }

  @Post('ai-suggest-message')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  aiSuggest(@Body() body: { objective?: string; segment?: string; tone?: string }) {
    return this.svc.aiSuggestMessage(body);
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────

  @Get('campaigns')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listCampaigns(
    @CurrentTenant() t: TenantContext,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listCampaigns(t.id, {
      status,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  createCampaign(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createCampaign(t.id, body);
  }

  @Post('campaigns/action')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  campaignAction(
    @CurrentTenant() t: TenantContext,
    @Body() body: { campaignId: string; action: 'start' | 'pause' | 'archive' | 'complete' | 'duplicate' },
  ) {
    return this.svc.campaignAction(t.id, body);
  }

  // ─── Funnels ─────────────────────────────────────────────────────────────

  @Get('funnels')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listFunnels(@CurrentTenant() t: TenantContext) {
    return this.svc.listFunnels(t.id);
  }

  @Post('funnels')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  createFunnel(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createFunnel(t.id, body);
  }

  // ─── Automations ─────────────────────────────────────────────────────────

  @Get('automations')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listAutomations(@CurrentTenant() t: TenantContext) {
    return this.svc.listAutomations(t.id);
  }

  @Post('automations')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  createAutomation(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.createAutomation(t.id, body);
  }

  @Patch('automations')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  updateAutomation(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.updateAutomation(t.id, body);
  }

  @Post('automations/delete')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  deleteAutomation(@CurrentTenant() t: TenantContext, @Body() body: { flowId: string }) {
    return this.svc.deleteAutomation(t.id, body);
  }

  @Post('automations/run')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  runAutomation(
    @CurrentTenant() t: TenantContext,
    @Body() body: { trigger: string; leadId?: string; context?: any; dryRun?: boolean },
  ) {
    // dryRun=true : aperçu (matche + planifie) SANS envoyer d'email réel — à utiliser pour les tests UI.
    return this.svc.runAutomation(t.id, body);
  }

  @Get('automations/audit')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listAutomationAudit(@CurrentTenant() t: TenantContext) {
    return this.svc.listAutomationAudit(t.id);
  }

  @Post('automations/audit')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  recordAutomationAudit(@CurrentTenant() t: TenantContext, @Body() body: any) {
    return this.svc.recordAutomationAudit(t.id, body);
  }

  // ─── Leads ───────────────────────────────────────────────────────────────

  @Get('leads')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listLeads(
    @CurrentTenant() t: TenantContext,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listLeads(t.id, {
      status,
      search,
      segment,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
  }

  // Anti-spam mémoire : fenêtre glissante par IP (endpoint public sans auth).
  private static readonly CAPTURE_WINDOW_MS = 10 * 60 * 1000; // 10 min
  private static readonly CAPTURE_MAX_PER_WINDOW = 30;
  private readonly captureHits = new Map<string, { count: number; resetAt: number }>();

  /**
   * PUBLIC : capture de lead sans auth (appelé depuis une landing / un funnel).
   *
   * SÉCURITÉ : le `tenant_id` n'est JAMAIS lu du body (spoofable → un tiers
   * pourrait injecter des leads dans n'importe quel tenant). Il est résolu depuis
   * l'ORIGINE de la requête (header Origin, sinon Referer), qui doit correspondre
   * à un domaine tenant ENREGISTRÉ (`tenant_domains`, custom_host ou embed_origin,
   * actif). Origine inconnue → 403. Un rate-limit par IP freine le spam.
   */
  @Post('leads/capture')
  async captureLead(@Req() req: any, @Body() body: any) {
    this.throttleCapture(req);
    const originHost = this.captureOriginHost(req);
    const tenantId = originHost
      ? await this.tenants.resolveTenantIdByOrigin(originHost)
      : null;
    if (!tenantId) {
      throw new ForbiddenException(
        "Origine de capture non reconnue : le domaine doit être enregistré pour un tenant.",
      );
    }
    // On IMPOSE le tenant résolu et on neutralise toute valeur du body.
    return this.svc.captureLead({ ...body, tenant_id: tenantId, tenantId });
  }

  /** Hôte (host:port) de l'origine de la requête, depuis Origin puis Referer. */
  private captureOriginHost(req: any): string | null {
    const raw = String(req?.headers?.origin || req?.headers?.referer || '').trim();
    if (!raw) return null;
    try {
      return new URL(raw).host.toLowerCase();
    } catch {
      return null;
    }
  }

  /** Rate-limit mémoire par IP ; lève 429 au-delà du plafond dans la fenêtre. */
  private throttleCapture(req: any): void {
    const ip = String(
      (req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        'unknown',
    );
    const now = Date.now();
    // Purge opportuniste des entrées expirées (borne la mémoire de l'endpoint public).
    if (this.captureHits.size > 5000) {
      for (const [k, v] of this.captureHits) {
        if (now > v.resetAt) this.captureHits.delete(k);
      }
    }
    const cur = this.captureHits.get(ip);
    if (!cur || now > cur.resetAt) {
      this.captureHits.set(ip, {
        count: 1,
        resetAt: now + MarketingAdvancedController.CAPTURE_WINDOW_MS,
      });
      return;
    }
    cur.count += 1;
    if (cur.count > MarketingAdvancedController.CAPTURE_MAX_PER_WINDOW) {
      throw new HttpException(
        'Trop de captures depuis cette adresse, réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
