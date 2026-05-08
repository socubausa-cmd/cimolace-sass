import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PatientRecordService } from "./patient-record.service";

@Controller("med/patients")
@UseGuards(JwtAuthGuard, TenantGuard)
export class PatientRecordController {
  constructor(private service: PatientRecordService) {}

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const record = await this.service.create(req.tenant.id, body);
    return { data: record };
  }

  @Get()
  async findAll(@Req() req: any) {
    const records = await this.service.findAll(req.tenant.id);
    return { data: records };
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    const record = await this.service.findOne(req.tenant.id, id);
    return { data: record };
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const record = await this.service.update(req.tenant.id, id, body);
    return { data: record };
  }
}
