import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { ChatEngineService } from './chat-engine.service';

@Controller('chat-engine')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChatEngineController {
  constructor(private readonly svc: ChatEngineService) {}
  @Post('rooms') createRoom(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createRoom(t.id, d.name, d.type); }
  @Get('rooms') listRooms(@CurrentTenant() t: TenantContext) { return this.svc.listRooms(t.id); }
  @Post('rooms/:id/join') joinRoom(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.joinRoom(t.id, id, (r as any).user.id); }
  @Post('rooms/:id/messages') sendMessage(@Param('id') id: string, @Body('content') c: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.sendMessage(t.id, id, (r as any).user.id, c); }
  @Get('rooms/:id/messages') getMessages(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getMessages(t.id, id); }
  @Get('rooms/:id/online') getOnline(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getOnlineUsers(t.id, id); }
  // DM 1-à-1 : ouvre/réutilise la room privée avec :userId (même moteur que le chat live/groupe).
  @Post('direct/:userId') openDirect(@Param('userId') userId: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.openDirectRoom(t.id, (r as any).user.id, userId); }
  // Chat du live : room logique 'live:<sessionId>' servie par le même moteur (backing live_session_chat).
  @Post('live/:liveSessionId') openLive(@Param('liveSessionId') liveSessionId: string, @CurrentTenant() t: TenantContext) { return this.svc.openLiveRoom(t.id, liveSessionId); }
}
