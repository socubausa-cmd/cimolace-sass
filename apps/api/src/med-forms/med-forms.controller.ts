import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedFormsService } from "./med-forms.service";

@Controller("med/forms")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedFormsController {
  constructor(private svc: MedFormsService) {}
  @Get() async findAll(@Req() req: any) { return { data: await this.svc.findAll(req.tenant.id) }; }
  @Get(":id") async findOne(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.findOne(req.tenant.id, id) }; }
  @Post() async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.create(req.tenant.id, b) }; }
  @Post(":id/responses") async submit(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.submitResponse(req.tenant.id, id, b.patient_id, b.responses) }; }
  @Get(":id/responses") async getResponses(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.getResponses(req.tenant.id, id) }; }
}
