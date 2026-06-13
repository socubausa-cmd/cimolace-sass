import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { LiveService } from "./live.service";

@Controller("lives")
@UseGuards(JwtAuthGuard, TenantGuard)
export class LiveController {
  constructor(private svc: LiveService) {}
  @Post() async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.createSession(req.tenant.id, b) }; }
  @Get() async findAll(@Req() req: any) { return { data: await this.svc.findAll(req.tenant.id) }; }
  @Get(":id") async findOne(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.findOne(req.tenant.id, id) }; }
  @Post(":id/token") async token(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.generateToken(id, req.user.id, b.role) }; }
  @Post(":id/start") async start(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.startSession(req.tenant.id, id) }; }
  @Post(":id/end") async end(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.endSession(req.tenant.id, id) }; }
  @Post(":id/recording/start") async recStart(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.startRecording(req.tenant.id, id) }; }
  @Post(":id/recording/stop") async recStop(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.stopRecording(req.tenant.id, id) }; }
}
