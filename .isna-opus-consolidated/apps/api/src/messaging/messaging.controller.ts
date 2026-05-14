import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateGroupDto, SendMessageDto } from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagingController {
  constructor(private readonly svc: MessagingService) {}

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.sendMessage(t, (req as any).user.id, dto); }

  @Get('conversations')
  listConversations(@CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.listConversations(t.id, (req as any).user.id); }

  @Get('conversations/:id')
  getMessages(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.getMessages(t.id, id, (req as any).user.id); }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto, @CurrentTenant() t: TenantContext, @Req() req: Request) { return this.svc.createGroup(t, (req as any).user.id, dto); }

  @Post('groups/:id/members')
  addMember(@Param('id') id: string, @Body('userId') uid: string, @CurrentTenant() t: TenantContext) { return this.svc.addGroupMember(t.id, id, uid); }
}
