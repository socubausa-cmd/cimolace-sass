import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateLiveDto } from './create-live.dto';
import { AnswerQuestionDto, AskQuestionDto, SendChatDto } from './dto/live-chat.dto';
import { LiveService } from './live.service';

@Controller('lives')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LiveController {
  constructor(private readonly liveService: LiveService) {}
  @Post() @UseGuards(RolesGuard) @Roles('owner','admin','teacher') create(@Body() d: CreateLiveDto, @CurrentUser() u: AuthUser, @CurrentTenant() t: TenantContext) { return this.liveService.create(d, u.id, t); }
  @Get() findAll(@CurrentTenant() t: TenantContext, @Query('limit') l?: string, @Query('offset') o?: string) { return this.liveService.findAll(t.id, l ? parseInt(l) : 20, o ? parseInt(o) : 0); }
  // ── Debate ───────────────────────────────────────────────────────────────
  @Post('debates') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') createDebate(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.createDebate(t.id, (r as any).user.id, d); }
  @Get('debates') listDebates(@CurrentTenant() t: TenantContext) { return this.liveService.listDebates(t.id); }
  @Get('debates/:id') getDebate(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getDebate(t.id, id); }
  @Post('debates/:id/vote') submitVote(@Param('id') id: string, @Body('side') side: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.submitVote(t.id, id, (r as any).user.id, side); }
  @Get('debates/:id/results') getResults(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getDebateResults(t.id, id); }

    @Get(':id') findOne(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.findOne(id, t.id); }
  @Get(':id/token') getToken(@Param('id') id: string, @CurrentUser() u: AuthUser, @CurrentTenant() t: TenantContext) { return this.liveService.getJoinToken(id, u, t); }
  @Post(':id/chat') sendChat(@Param('id') id: string, @Body() d: SendChatDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.sendChatMessage(id, t, (r as any).user.id, d); }
  @Get(':id/chat') getChat(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getChatMessages(id, t.id); }
  @Post(':id/questions') askQuestion(@Param('id') id: string, @Body() d: AskQuestionDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.askQuestion(id, t, (r as any).user.id, d); }
  @Get(':id/questions') getQuestions(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getQuestions(id, t.id); }
  @Post(':id/questions/:qid/answer') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') answerQuestion(@Param('id') id: string, @Param('qid') qid: string, @Body() d: AnswerQuestionDto, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.answerQuestion(id, qid, t.id, (r as any).user.id, d); }
  @Get(':id/transcript') getTranscript(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getTranscript(id, t.id); }
  @Get(':id/participants') getParticipants(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getParticipants(id, t.id); }

  // ── Scripts ──────────────────────────────────────────────────────────────
  @Post(':id/scripts') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') saveScript(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.liveService.saveScript(id, t.id, d.sections); }
  @Get(':id/scripts') getScript(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getScript(id, t.id); }

  // ── Waiting Room ─────────────────────────────────────────────────────────
  @Get(':id/waiting-room') getWaitingRoom(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.getWaitingRoom(id, t.id); }
  @Post(':id/waiting-room/admit') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') admitToRoom(@Param('id') id: string, @Body('userId') uid: string, @CurrentTenant() t: TenantContext) { return this.liveService.admitToRoom(id, t.id, uid); }

  // ── Immersive ────────────────────────────────────────────────────────────
  @Post('immersive/rooms') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') createImmersive(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.createImmersiveRoom(t.id, (r as any).user.id, d.guestUserId); }
  @Get('immersive/:id/token') getImmersiveToken(@Param('id') id: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.getImmersiveToken(id, (r as any).user.id, t.id); }
  @Post('immersive/:id/companion-link') generateCompanionLink(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.generateCompanionLink(id, t.id); }
  @Post('immersive/:id/companion-exchange') exchangeCompanion(@Param('id') id: string, @Body('code') code: string, @Req() r: Request) { return this.liveService.exchangeCompanionToken(id, code, (r as any).user.id); }

  // ── Recording ────────────────────────────────────────────────────────────
  @Post(':id/recording/start') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') startRecording(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.startRecording(id, t.id); }
  @Post(':id/recording/stop') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') stopRecording(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.stopRecording(id, t.id); }

  // ── Mobile Camera ────────────────────────────────────────────────────────
  @Post(':id/mobile-camera-link') generateMobileLink(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.liveService.generateMobileCameraLink(id, t.id); }
  @Post(':id/mobile-camera-exchange') exchangeMobileToken(@Param('id') id: string, @Body('code') code: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.liveService.exchangeMobileCameraToken(id, code, (r as any).user.id, t.id); }

  // ── Invitations ──────────────────────────────────────────────────────────
  @Post(':id/invitations') @UseGuards(RolesGuard) @Roles('owner','admin','teacher') sendInvitations(@Param('id') id: string, @Body('emails') emails: string[], @CurrentTenant() t: TenantContext) { return this.liveService.sendInvitations(id, t.id, emails); }
}
