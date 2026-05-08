import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedHealthService } from "./med-health.service";

@Controller("med/health")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedHealthController {
  constructor(private svc: MedHealthService) {}
  @Post() async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.create(req.tenant.id, { ...b, patient_user_id: req.user.id }) }; }
  @Get("patient/:patientId") async findByPatient(@Req() req: any, @Param("patientId") id: string) { return { data: await this.svc.findByPatient(req.tenant.id, id) }; }
}
