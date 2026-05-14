import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { NeuroRecallService } from './neuro-recall.service';

@Controller('neuro-recall')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NeuroRecallController {
  constructor(private readonly svc: NeuroRecallService) {}
  @Post('decks') createDeck(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createDeck(t.id, (r as any).user.id, d.title, d.cards); }
  @Get('decks') listDecks(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.listDecks(t.id, (r as any).user.id); }
  @Get('decks/:id/due') getDueCards(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getDueCards(t.id, id, (r as any).user.id); }
  @Post('cards/:id/review') reviewCard(@Param('id') id: string, @Body('quality') q: number, @CurrentTenant() t: TenantContext) { return this.svc.reviewCard(t.id, id, q); }
  @Get('stats') getStats(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getStats(t.id, (r as any).user.id); }
}
