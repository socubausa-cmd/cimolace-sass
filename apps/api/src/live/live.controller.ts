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
  @Post(":id/token") async token(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.generateToken(id, req.user.id, b.role) }; }
}
