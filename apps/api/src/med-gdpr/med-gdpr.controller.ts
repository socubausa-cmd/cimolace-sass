import { Controller, Get, Post, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedGdprService } from "./med-gdpr.service";

@Controller("med/gdpr")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedGdprController {
  constructor(private svc: MedGdprService) {}
  @Get("export/:recordId") async export(@Req() req: any, @Param("recordId") id: string) { return { data: await this.svc.exportPatientData(req.tenant.id, id) }; }
  @Post("anonymize/:recordId") async anonymize(@Req() req: any, @Param("recordId") id: string) { return { data: await this.svc.anonymize(req.tenant.id, id) }; }
}
