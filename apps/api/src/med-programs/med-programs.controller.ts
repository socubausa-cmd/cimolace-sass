import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MedProgramsService } from "./med-programs.service";

@Controller("med/programs")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MedProgramsController {
  constructor(private svc: MedProgramsService) {}
  @Get() async findAll(@Req() req: any) { return { data: await this.svc.findAll(req.tenant.id) }; }
  @Post() async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.create(req.tenant.id, b) }; }
  @Post(":id/steps") async addStep(@Param("id") id: string, @Body() b: any) { return { data: await this.svc.addStep(id, b) }; }
  @Post(":id/assign") async assign(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.assign(req.tenant.id, id, b.patient_id, b.record_id) }; }
  @Get("patient/:patientId") async findByPatient(@Req() req: any, @Param("patientId") pid: string) { return { data: await this.svc.findByPatient(req.tenant.id, pid) }; }
}
