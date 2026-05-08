import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedPrescriptionsService } from "./med-prescriptions.service";

@Controller("med/prescriptions")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedPrescriptionsController {
  constructor(private svc: MedPrescriptionsService) {}
  @Post() async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.create(req.tenant.id, { ...b, practitioner_id: req.user.id }) }; }
  @Get("record/:recordId") async findByRecord(@Req() req: any, @Param("recordId") rid: string) { return { data: await this.svc.findByRecord(req.tenant.id, rid) }; }
  @Post(":id/sign") async sign(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.sign(req.tenant.id, id) }; }
}
