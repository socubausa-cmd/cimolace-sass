import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { LiriEntitlementsService } from '../billing/liri-entitlements.service';
import { NeuroRecallService } from './neuro-recall.service';

@Controller('neuro-recall')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NeuroRecallController {
  constructor(
    private readonly svc: NeuroRecallService,
    private readonly entitlements: LiriEntitlementsService,
  ) {}
  // Création d'un deck NeuroRecall = feature PAYANTE (révision espacée IA). Lecture
  // (listDecks/due/review/stats) reste ouverte pour ne pas casser l'existant des élèves.
  @Post('decks') async createDeck(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) {
    const { limits } = await this.entitlements.resolveLimits(t.id);
    if (!limits.canNeuroRecall) {
      throw new ForbiddenException("Forfait gratuit : NeuroRecall (révision espacée IA) n'est pas inclus. Passez à un forfait LIRI pour créer des decks.");
    }
    return this.svc.createDeck(t.id, (r as any).user.id, d.title, d.cards);
  }
  @Get('decks') listDecks(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.listDecks(t.id, (r as any).user.id); }
  @Get('decks/:id/due') getDueCards(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getDueCards(t.id, id, (r as any).user.id); }
  @Post('cards/:id/review') reviewCard(@Param('id') id: string, @Body('quality') q: number, @CurrentTenant() t: TenantContext) { return this.svc.reviewCard(t.id, id, q); }
  @Get('stats') getStats(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getStats(t.id, (r as any).user.id); }
}
