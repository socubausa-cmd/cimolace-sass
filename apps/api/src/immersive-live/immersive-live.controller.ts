/**
 * ImmersiveLiveController — endpoints REST des 8 lambdas v1.
 *
 * Routes :
 *   POST   /immersive-live/livekit/create-room          → créer room (auth)
 *   POST   /immersive-live/livekit/get-token            → token LiveKit (auth)
 *   POST   /immersive-live/livekit/create-companion-link → lien magique mobile
 *   POST   /immersive-live/livekit/companion-exchange   → token opaque → LiveKit (public)
 *   POST   /immersive-live/livekit/participant-leave    → marquer sortie
 *   GET    /immersive-live/context-snapshot             → état utilisateur (auth optionnel)
 *   POST   /immersive-live/ai-guide                     → assistant navigation IA
 *   POST   /immersive-live/nav-track                    → tracking nav
 */

import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { SupabaseService } from '../supabase/supabase.service';
import { ImmersiveLiveService } from './immersive-live.service';

@Controller('immersive-live')
export class ImmersiveLiveController {
  constructor(
    private readonly svc: ImmersiveLiveService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('livekit/create-room')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createRoom(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { liveSessionId?: string; live_session_id?: string },
  ) {
    return this.svc.createRoom({
      tenantId: t.id,
      tenantSlug: t.slug,
      userId: (req as any).user.id,
      liveSessionId: body.liveSessionId ?? body.live_session_id ?? '',
    });
  }

  @Post('livekit/get-token')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getToken(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { liveSessionId?: string; live_session_id?: string; role?: 'host' | 'viewer' },
  ) {
    return this.svc.getToken({
      tenantId: t.id,
      userId: (req as any).user.id,
      userName: (req as any).user.email,
      liveSessionId: body.liveSessionId ?? body.live_session_id ?? '',
      role: body.role,
    });
  }

  @Post('livekit/create-companion-link')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createCompanionLink(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Headers('origin') origin: string,
    @Body() body: { liveSessionId?: string; live_session_id?: string },
  ) {
    return this.svc.createCompanionLink({
      tenantId: t.id,
      userId: (req as any).user.id,
      liveSessionId: body.liveSessionId ?? body.live_session_id ?? '',
      origin,
    });
  }

  /** Public — pas d'auth requise (token opaque sert d'auth) */
  @Post('livekit/companion-exchange')
  async companionExchange(@Body() body: { token: string; displayName?: string }) {
    return this.svc.companionExchange(body);
  }

  @Post('livekit/participant-leave')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async participantLeave(
    @CurrentTenant() t: TenantContext,
    @Req() req: Request,
    @Body() body: { liveSessionId?: string; live_session_id?: string },
  ) {
    return this.svc.participantLeave({
      tenantId: t.id,
      userId: (req as any).user.id,
      liveSessionId: body.liveSessionId ?? body.live_session_id ?? '',
    });
  }

  /** Public avec auth optionnelle — extrait le user du JWT si présent */
  @Get('context-snapshot')
  async contextSnapshot(@Req() req: Request) {
    const userId = await this.extractUserIdOptional(req);
    return this.svc.contextSnapshot(userId);
  }

  /** Public — utilisé par le widget IA du site vitrine */
  @Post('ai-guide')
  async aiGuide(
    @Req() req: Request,
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body() body: { message: string; siteMap?: any[]; tenant_slug?: string },
  ) {
    const slug = tenantSlug ?? body.tenant_slug;
    let tenantId: string | null = null;
    if (slug) {
      const { data } = await (this.supabase.client as any)
        .from('tenants').select('id').eq('slug', slug).maybeSingle();
      tenantId = data?.id ?? null;
    }
    const userId = await this.extractUserIdOptional(req);
    return this.svc.aiGuide({ tenantId, userId, message: body.message, siteMap: body.siteMap });
  }

  /** Public — tracking événements (auth optionnelle) */
  @Post('nav-track')
  async navTrack(
    @Req() req: Request,
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body() body: any,
  ) {
    let tenantId: string | null = null;
    if (tenantSlug) {
      const { data } = await (this.supabase.client as any)
        .from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
      tenantId = data?.id ?? null;
    }
    const userId = await this.extractUserIdOptional(req);
    return this.svc.navTrack({
      tenantId,
      userId,
      eventType: body.eventType,
      sessionId: body.sessionId,
      topActionId: body.topActionId,
      runtimeContext: body.runtimeContext,
      metadata: body.metadata,
    });
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private async extractUserIdOptional(req: Request): Promise<string | null> {
    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    try {
      const { data } = await (this.supabase.client as any).auth.getUser(token);
      return data?.user?.id ?? null;
    } catch {
      return null;
    }
  }
}
