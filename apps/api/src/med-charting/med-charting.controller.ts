import { Controller, Post, Get, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedChartingService } from "./med-charting.service";

@Controller("med/charting")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedChartingController {
  constructor(private svc: MedChartingService) {}
  @Post("transcribe") async transcribe(@Req() req: any, @Body() b: any) { return { data: await this.svc.transcribe(req.tenant.id, b.audio_url) }; }
  @Post("generate") async generate(@Req() req: any, @Body() b: any) { return { data: await this.svc.generateNote(req.tenant.id, b.transcript) }; }
  @Post("regenerate/:noteId") async regenerate(@Req() req: any, @Param("noteId") id: string) { return { data: await this.svc.regenerate(req.tenant.id, id) }; }
}
