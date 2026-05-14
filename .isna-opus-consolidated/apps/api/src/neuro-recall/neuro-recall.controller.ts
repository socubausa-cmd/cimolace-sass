import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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
  @Delete('decks/:id') deleteDeck(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deleteDeck(t.id, id); }

  @Get('decks/:id/due') getDueCards(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getDueCards(t.id, id, (r as any).user.id); }
  @Post('cards/:id/review') reviewCard(@Param('id') id: string, @Body('quality') q: number, @CurrentTenant() t: TenantContext) { return this.svc.reviewCard(t.id, id, q); }

  // Bootstrap / Generate
  @Post('bootstrap') bootstrap(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.bootstrapSession(t.id, (r as any).user.id, d.sourceText, d.title); }
  @Post('generate-from-course') generateFromCourse(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.generateFromCourse(t.id, (r as any).user.id, d.courseText); }
  @Post('postprod-from-pipeline') createPostProd(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createPostProdContent(t.id, (r as any).user.id, d.pipelineId); }

  // Analytics
  @Get('decks/:id/report') getNodeReport(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getNodeReport(t.id, id); }
  @Get('stats') getStats(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getGlobalStats(t.id, (r as any).user.id); }
}
